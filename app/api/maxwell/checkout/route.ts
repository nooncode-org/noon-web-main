import { NextResponse } from "next/server";
import { z } from "zod";
import {
  appendPaymentEvent,
  getProposalRequestByPublicToken,
  getStudioSession,
  getStudioVersions,
  updateProposalRequestStatus,
} from "@/lib/maxwell/repositories";
import { buildWebsiteProposalPayload } from "@/lib/noon-app-integration";
import { buildPublicProposalUrl } from "@/lib/maxwell/public-url";
import { StripeConfigError, getStripeClient, toStripeMinorUnit } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  public_token: z.string().min(1),
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

    if (proposal.status === "expired") {
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

    const stripe = getStripeClient();
    const publicUrl = buildPublicProposalUrl(proposal.publicToken, request);

    if (proposal.stripeCheckoutSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(proposal.stripeCheckoutSessionId);
      if (existing.status === "open" && existing.url) {
        return NextResponse.json({
          checkout_url: existing.url,
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
    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: proposal.id,
        customer_email: customerEmail,
        success_url: `${publicUrl}?checkout=success`,
        cancel_url: `${publicUrl}?checkout=cancelled`,
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
        metadata: {
          source: "noon_website",
          external_session_id: session.id,
          external_proposal_id: proposal.id,
          public_token: proposal.publicToken,
          amount_usd: String(websitePayload.proposal.amount),
          currency: websitePayload.proposal.currency,
        },
        payment_intent_data: {
          metadata: {
            source: "noon_website",
            external_session_id: session.id,
            external_proposal_id: proposal.id,
          },
        },
      },
      {
        idempotencyKey: `noon-checkout:${proposal.id}:${unitAmount}:${currency}`,
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
      checkout_url: checkoutSession.url,
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

    console.error("Maxwell checkout error:", error);
    return NextResponse.json(
      { message: "Could not start Stripe Checkout. Please try again." },
      { status: 500 },
    );
  }
}
