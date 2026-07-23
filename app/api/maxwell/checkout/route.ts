import { NextResponse } from "next/server";
import { z } from "zod";
import {
  appendPaymentEvent,
  getProposalRequestByPublicToken,
  getStudioSession,
  getStudioVersions,
  updateProposalRequest,
  updateProposalRequestStatus,
} from "@/lib/maxwell/repositories";
import { resolveProposalCommercialProfile } from "@/lib/maxwell/proposal-rules";
import { isProposalPastCutoff } from "@/lib/maxwell/proposal-visibility";
import { MEMBERSHIP_BILLING_ENABLED, MEMBERSHIP_INTERVAL } from "@/lib/maxwell/membership-billing";
import {
  HOSTING_FIRST_YEAR_INCLUDED,
  HOSTING_TRIAL_DAYS,
  hostingPriceUsd,
  shouldBillHosting,
} from "@/lib/maxwell/hosting-billing";
import { buildWebsiteProposalPayload } from "@/lib/noon-app-integration";
import { buildPublicProposalUrl } from "@/lib/maxwell/public-url";
import { log } from "@/lib/server/logger";
import { StripeConfigError, getStripeClient, toStripeMinorUnit } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  public_token: z.string().min(1),
  // v3 membership (M0): the modality the client picks on the proposal page.
  // Defaults to one_time for back-compat with clients that omit it.
  payment_modality: z.enum(["one_time", "membership"]).optional().default("one_time"),
  // One-time only: how their hosting recurs after the included first year.
  // Defaults to yearly — the discounted plan, and the one we want them on.
  hosting_interval: z.enum(["month", "year"]).optional().default("year"),
});

const PAYABLE_STATUSES = new Set(["sent", "payment_pending"]);

function checkoutStateResponse(status: number, message: string, code: string) {
  return NextResponse.json({ message, code }, { status });
}

export async function POST(request: Request) {
  try {
    const payload = checkoutSchema.parse(await request.json());
    const proposal = await getProposalRequestByPublicToken(payload.public_token);

    if (!proposal) {
      return checkoutStateResponse(404, "Proposal not found.", "PROPOSAL_NOT_FOUND");
    }

    if (proposal.status === "paid") {
      return checkoutStateResponse(409, "This proposal is already paid.", "PROPOSAL_ALREADY_PAID");
    }

    if (proposal.status === "expired" || isProposalPastCutoff(proposal)) {
      // SEC-M2: el cutoff duro (expires_at) cierra el checkout aunque nadie haya
      // flipeado el status a 'expired' todavía.
      return checkoutStateResponse(410, "This proposal has expired.", "PROPOSAL_EXPIRED");
    }

    if (proposal.status === "payment_under_verification") {
      return checkoutStateResponse(
        409,
        "This proposal is already under payment verification.",
        "PAYMENT_UNDER_VERIFICATION",
      );
    }

    if (!PAYABLE_STATUSES.has(proposal.status)) {
      return checkoutStateResponse(
        409,
        "This proposal is not ready for payment.",
        "PROPOSAL_NOT_PAYABLE",
      );
    }

    const session = await getStudioSession(proposal.studioSessionId);
    if (!session) {
      return checkoutStateResponse(404, "Associated session not found.", "SESSION_NOT_FOUND");
    }

    if (session.status !== "proposal_sent") {
      return checkoutStateResponse(
        409,
        "Payment can only start after the proposal has been sent.",
        "SESSION_NOT_AWAITING_PAYMENT",
      );
    }

    if (proposal.approvedAmountUsd == null || proposal.approvedAmountUsd <= 0) {
      return checkoutStateResponse(
        409,
        "This proposal does not have an approved payment amount.",
        "APPROVED_AMOUNT_REQUIRED",
      );
    }

    if (proposal.approvedCurrency?.toUpperCase() !== "USD") {
      return checkoutStateResponse(
        409,
        "Only USD payments are supported for this launch.",
        "UNSUPPORTED_CURRENCY",
      );
    }

    // v3 membership (M0): persist the client's chosen modality + the
    // engine-derived recurring monthly BEFORE the Stripe session logic, so the
    // choice is captured on every checkout attempt (incl. the reuse path below).
    // The CHARGED amount stays the PM-approved activation (`approvedAmountUsd`);
    // the monthly is NOT charged yet — membership is billed manually until M1.
    const paymentModality = payload.payment_modality;
    const monthlyAmountUsd =
      paymentModality === "membership"
        ? resolveProposalCommercialProfile(session).monthlyAmountUsd
        : null;
    await updateProposalRequest(proposal.id, { paymentModality, monthlyAmountUsd });

    const stripe = getStripeClient();
    const publicUrl = buildPublicProposalUrl(proposal.publicToken, request);

    if (proposal.stripeCheckoutSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(proposal.stripeCheckoutSessionId);
      // Embedded Checkout: reuse an open session by returning its client_secret
      // (the browser re-mounts it in-place — there is no redirect URL). A
      // client_secret is only present on embedded sessions; sessions created
      // before the embedded switch (hosted `url`, client_secret null) fall through
      // and a fresh embedded session is created below.
      if (existing.status === "open" && existing.client_secret) {
        return NextResponse.json({
          client_secret: existing.client_secret,
          checkout_session_id: existing.id,
          reused: true,
        });
      }
    }

    const versions = await getStudioVersions(session.id);
    const websitePayload = buildWebsiteProposalPayload({ session, proposal, versions });
    const currency = websitePayload.proposal.currency.toLowerCase();
    const unitAmount = toStripeMinorUnit(websitePayload.proposal.amount, currency);
    const customerEmail = websitePayload.customer.email;
    const productName = websitePayload.proposal.title || "Noon project";

    // v3 membership M1: a membership checkout becomes a Stripe subscription
    // (Option A) ONLY when the flag is on AND we have an engine-derived monthly.
    // Otherwise (flag off, or one_time) we fall back to the M0 one-time charge —
    // byte-identical to the pre-M1 behavior, no client error.
    const monthlyMinor =
      monthlyAmountUsd != null ? toStripeMinorUnit(monthlyAmountUsd, currency) : 0;
    const isMembershipCheckout =
      paymentModality === "membership" && MEMBERSHIP_BILLING_ENABLED && monthlyAmountUsd != null;

    // A ONE-TIME buyer pays for the build once and then keeps the site online
    // with a YEARLY hosting fee (owner 2026-07-22; price 2026-07-23). Same
    // Option A shape as the membership — one subscription whose first invoice
    // carries the one-time build line — only the interval is `year`, so the
    // webhook, the Billing Portal and the lifecycle wire need no new plumbing.
    const isHostingCheckout = shouldBillHosting(paymentModality);
    const hostingInterval = payload.hosting_interval;
    const hostingUsd = hostingPriceUsd(hostingInterval);
    const hostingMinor = isHostingCheckout ? toStripeMinorUnit(hostingUsd, currency) : 0;

    // Shared metadata — read back by the Stripe webhook to correlate + route
    // activation. Identical keys across both modes so the webhook reads the same
    // shape regardless of `mode`.
    const checkoutMetadata = {
      source: "noon_website",
      external_session_id: session.id,
      external_proposal_id: proposal.id,
      public_token: proposal.publicToken,
      amount_usd: String(websitePayload.proposal.amount),
      currency: websitePayload.proposal.currency,
      payment_modality: paymentModality,
      monthly_amount_usd: monthlyAmountUsd != null ? String(monthlyAmountUsd) : "",
      // Present ONLY on a one-time checkout that carries hosting, so the webhook
      // (and a human reading the Stripe dashboard) can tell a yearly hosting
      // subscription apart from a monthly membership one.
      ...(isHostingCheckout
        ? { hosting_price_usd: String(hostingUsd), billing_interval: hostingInterval }
        : {}),
    };

    const checkoutSession = isMembershipCheckout
      ? await stripe.checkout.sessions.create(
          {
            // Option A: ONE subscription checkout — the recurring monthly is the
            // subscription line; the activation rides the FIRST invoice as a
            // one-time `add_invoice_items`. Single customer+subscription = one
            // lifecycle stream for the recurring webhooks. Earnings stay 1× on
            // the activation (payment-confirmed sends payment.amount = activation).
            mode: "subscription",
            ui_mode: "embedded_page",
            client_reference_id: proposal.id,
            customer_email: customerEmail,
            // Embedded Checkout returns to the proposal page in-place after the
            // charge; the Stripe webhook stays the source of truth for `paid`.
            return_url: `${publicUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            // Stripe collects the billing address inside the widget (this replaces
            // the bespoke address form the website used to render on this side).
            billing_address_collection: "required",
            line_items: [
              {
                // Activation — a ONE-TIME line item (no `recurring`). Stripe bills
                // one-time line items on the FIRST invoice of a subscription-mode
                // Checkout, so the first charge = activation + monthly (Option A).
                // (dahlia's `subscription_data` has no `add_invoice_items`; a mixed
                // line_items list is the supported equivalent.)
                quantity: 1,
                price_data: {
                  currency,
                  unit_amount: unitAmount,
                  product_data: {
                    name: `${productName} — activation`,
                    description: "Noon project activation payment",
                  },
                },
              },
              {
                // Recurring monthly membership.
                quantity: 1,
                price_data: {
                  currency,
                  unit_amount: monthlyMinor,
                  recurring: { interval: MEMBERSHIP_INTERVAL },
                  product_data: {
                    name: `${productName} — membership`,
                    description: "Noon membership monthly",
                  },
                },
              },
            ],
            subscription_data: {
              metadata: checkoutMetadata,
            },
            metadata: checkoutMetadata,
          },
          {
            idempotencyKey: `noon-checkout-sub-emb:${proposal.id}:${unitAmount}:${monthlyMinor}:${currency}`,
          },
        )
      : isHostingCheckout
        ? await stripe.checkout.sessions.create(
            {
              // One-time + yearly hosting: same Option A shape as the
              // membership, interval `year`. The build is the one-time line on
              // the first invoice; hosting recurs every year after it.
              mode: "subscription",
              ui_mode: "embedded_page",
              client_reference_id: proposal.id,
              customer_email: customerEmail,
              return_url: `${publicUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
              billing_address_collection: "required",
              line_items: [
                {
                  // The build — ONE-TIME (no `recurring`), billed on the first
                  // invoice alongside the first hosting year.
                  quantity: 1,
                  price_data: {
                    currency,
                    unit_amount: unitAmount,
                    product_data: {
                      name: `${productName} — build`,
                      description: "Noon project build (one-time)",
                    },
                  },
                },
                {
                  // Hosting — yearly by default (the discounted plan) or
                  // monthly if the client chose it. The DOMAIN is billed
                  // separately: do not fold it in here (owner 2026-07-23).
                  quantity: 1,
                  price_data: {
                    currency,
                    unit_amount: hostingMinor,
                    recurring: { interval: hostingInterval },
                    product_data: {
                      name: `${productName} — hosting`,
                      description: `Noon hosting, billed ${hostingInterval === "month" ? "monthly" : "yearly"}`,
                    },
                  },
                },
              ],
              subscription_data: {
                metadata: checkoutMetadata,
                // First hosting year included in the build price (owner
                // 2026-07-23): the recurring line doesn't bill until the trial
                // ends, while the one-time BUILD line still invoices today.
                ...(HOSTING_FIRST_YEAR_INCLUDED
                  ? { trial_period_days: HOSTING_TRIAL_DAYS }
                  : {}),
              },
              metadata: checkoutMetadata,
            },
            {
              idempotencyKey: `noon-checkout-host-emb:${proposal.id}:${unitAmount}:${hostingMinor}:${hostingInterval}:${currency}`,
            },
          )
        : await stripe.checkout.sessions.create(
          {
            mode: "payment",
            ui_mode: "embedded_page",
            client_reference_id: proposal.id,
            customer_email: customerEmail,
            return_url: `${publicUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            billing_address_collection: "required",
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency,
                  unit_amount: unitAmount,
                  product_data: {
                    name: websitePayload.proposal.title || "Noon project activation",
                    description: "Noon project activation payment",
                  },
                },
              },
            ],
            metadata: checkoutMetadata,
            payment_intent_data: {
              metadata: {
                source: "noon_website",
                external_session_id: session.id,
                external_proposal_id: proposal.id,
              },
            },
          },
          {
            idempotencyKey: `noon-checkout-emb:${proposal.id}:${unitAmount}:${currency}`,
          },
        );

    await updateProposalRequestStatus(proposal.id, "payment_pending", {
      stripeCheckoutSessionId: checkoutSession.id,
    });

    await appendPaymentEvent({
      studioSessionId: session.id,
      eventType: "initiated",
      amountUsd: websitePayload.proposal.amount,
      reference: checkoutSession.id,
      notes: "Stripe Checkout Session created.",
      provider: "stripe",
      providerSessionId: checkoutSession.id,
      currency: websitePayload.proposal.currency,
      payloadJson: {
        checkout_session_id: checkoutSession.id,
        public_token: proposal.publicToken,
      },
      createdBy: "client",
    });

    return NextResponse.json({
      client_secret: checkoutSession.client_secret,
      checkout_session_id: checkoutSession.id,
      reused: false,
    });
  } catch (error) {
    if (error instanceof StripeConfigError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request.", fieldErrors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    log.error("maxwell.checkout", error);
    return NextResponse.json(
      { message: "Could not start Stripe Checkout. Please try again." },
      { status: 500 },
    );
  }
}
