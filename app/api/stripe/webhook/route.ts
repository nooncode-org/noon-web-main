import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { confirmProposalPayment, PaymentActivationError } from "@/lib/maxwell/payment-activation";
import {
  MEMBERSHIP_BILLING_ENABLED,
  mapStripeSubscriptionStatusToWire,
  type MembershipEventKind,
  type MembershipStatus,
} from "@/lib/maxwell/membership-billing";
import {
  getProposalRequest,
  getProposalRequestByStripeSubscriptionId,
  updateProposalRequest,
  type ProposalRequest,
} from "@/lib/maxwell/repositories";
import {
  NoonAppIntegrationError,
  sendMembershipLifecycleToNoonApp,
} from "@/lib/noon-app-integration";
import { log } from "@/lib/server/logger";
import {
  StripeConfigError,
  getStripeClient,
  getStripeObjectId,
  getStripeWebhookSecret,
} from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ignored(type: string, reason: string) {
  return NextResponse.json({ received: true, ignored: true, type, reason });
}

// ----------------------------------------------------------------------------
// One-time activation (pre-existing — unchanged behavior)
// ----------------------------------------------------------------------------

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status !== "paid") {
    return ignored(event.type, "Checkout Session is not paid yet.");
  }

  const proposalId = session.metadata?.external_proposal_id ?? session.client_reference_id;
  const studioSessionId = session.metadata?.external_session_id;

  if (!proposalId || !studioSessionId) {
    throw new PaymentActivationError(
      "Stripe Checkout Session is missing Noon metadata.",
      400,
      "STRIPE_METADATA_MISSING",
    );
  }

  const paymentIntentId = getStripeObjectId(session.payment_intent);

  const activation = await confirmProposalPayment({
    proposalRequestId: proposalId,
    actor: "stripe",
    paymentReference: paymentIntentId ?? session.id,
    summary: "Stripe Checkout payment confirmed.",
    provider: "stripe",
    providerEventId: event.id,
    providerSessionId: session.id,
    providerPaymentIntentId: paymentIntentId,
    paidAmountMinor: session.amount_total,
    paidCurrency: session.currency,
    paidAt: new Date(event.created * 1000).toISOString(),
    providerPayload: {
      stripe_event_id: event.id,
      stripe_event_type: event.type,
      checkout_session_id: session.id,
      payment_intent_id: paymentIntentId,
      amount_total: session.amount_total,
      currency: session.currency,
      external_session_id: studioSessionId,
    },
  });

  return NextResponse.json({
    received: true,
    handled: true,
    idempotent: activation.idempotent,
    proposal_status: activation.proposal.status,
    workspace_id: activation.workspace.id,
  });
}

// ----------------------------------------------------------------------------
// v3 membership billing M1 — recurring subscription lifecycle
// ----------------------------------------------------------------------------

/** Convert a Stripe unix-seconds timestamp to ISO-8601, or null. */
function isoFromUnixSeconds(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

/**
 * Read the subscription's current period end. Version-robust: dahlia
 * (2026-04-22) carries it per subscription ITEM; older API versions exposed it
 * at the subscription top level. Returns unix seconds or null.
 */
function readSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription): number | null {
  const items = subscription.items?.data ?? [];
  for (const item of items) {
    const end = (item as { current_period_end?: number }).current_period_end;
    if (typeof end === "number") return end;
  }
  const top = (subscription as { current_period_end?: number }).current_period_end;
  return typeof top === "number" ? top : null;
}

/**
 * Read the subscription id off an invoice. Version-robust: dahlia nests it under
 * `invoice.parent.subscription_details.subscription`; older API versions exposed
 * `invoice.subscription` at the top level.
 */
function readInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = (
    invoice as {
      parent?: {
        subscription_details?: { subscription?: string | { id?: string } | null } | null;
      } | null;
    }
  ).parent;
  const fromParent = getStripeObjectId(parent?.subscription_details?.subscription ?? null);
  if (fromParent) return fromParent;
  const top = (invoice as { subscription?: string | { id?: string } | null }).subscription;
  return getStripeObjectId(top ?? null);
}

/**
 * Resolve the proposal for a recurring event by the persisted subscription id,
 * falling back to the subscription's `metadata.external_proposal_id` (set on the
 * subscription at checkout via `subscription_data.metadata`).
 */
async function resolveMembershipProposal(
  subscriptionId: string,
  metadataProposalId: string | null | undefined,
): Promise<ProposalRequest | null> {
  const bySub = await getProposalRequestByStripeSubscriptionId(subscriptionId);
  if (bySub) return bySub;
  if (metadataProposalId) return getProposalRequest(metadataProposalId);
  return null;
}

async function forwardMembershipLifecycle(input: {
  event: Stripe.Event;
  proposal: ProposalRequest;
  subscriptionId: string;
  eventKind: MembershipEventKind;
  status: MembershipStatus;
  currentPeriodEnd: string | null;
}) {
  await sendMembershipLifecycleToNoonApp({
    externalSessionId: input.proposal.studioSessionId,
    externalProposalId: input.proposal.id,
    externalSubscriptionId: input.subscriptionId,
    externalEventId: input.event.id,
    eventKind: input.eventKind,
    status: input.status,
    currentPeriodEnd: input.currentPeriodEnd,
    // Whole USD dollars (amendment 3) — NoonWeb's engine-derived monthly, never
    // Stripe minor units. 0 only if a non-membership proposal slipped through.
    monthlyAmountUsd: input.proposal.monthlyAmountUsd ?? 0,
    created: input.event.created,
    metadata: { stripe_event_type: input.event.type },
  });
}

/**
 * Subscription-mode checkout completed → activation. Persists the Stripe
 * correlation ids, activates the workspace + sends `payment-confirmed` (earnings
 * 1× on the activation), then forwards `membership-lifecycle:activated`.
 *
 * `paidAmountMinor` is intentionally OMITTED: the first invoice total is
 * activation + monthly (Option A), which would not match the activation-only
 * approved amount. Activation integrity is guaranteed by the add_invoice_item we
 * built in checkout; the App credits earnings on `payment.amount` (= activation).
 */
async function handleSubscriptionCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status === "unpaid") {
    return ignored(event.type, "Subscription Checkout is not paid yet.");
  }

  const proposalId = session.metadata?.external_proposal_id ?? session.client_reference_id;
  const studioSessionId = session.metadata?.external_session_id;
  const subscriptionId = getStripeObjectId(session.subscription);
  const customerId = getStripeObjectId(session.customer);

  if (!proposalId || !studioSessionId) {
    throw new PaymentActivationError(
      "Stripe subscription Checkout is missing Noon metadata.",
      400,
      "STRIPE_METADATA_MISSING",
    );
  }
  if (!subscriptionId) {
    throw new PaymentActivationError(
      "Stripe subscription Checkout is missing a subscription id.",
      400,
      "STRIPE_SUBSCRIPTION_MISSING",
    );
  }

  // Persist the correlation ids FIRST so later recurring webhooks resolve back
  // to this proposal even before the activation handoff completes.
  await updateProposalRequest(proposalId, {
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
  });

  const activation = await confirmProposalPayment({
    proposalRequestId: proposalId,
    actor: "stripe",
    paymentReference: subscriptionId,
    summary: "Stripe subscription activation confirmed.",
    provider: "stripe",
    providerEventId: event.id,
    providerSessionId: session.id,
    paidCurrency: session.currency,
    paidAt: new Date(event.created * 1000).toISOString(),
    providerPayload: {
      stripe_event_id: event.id,
      stripe_event_type: event.type,
      checkout_session_id: session.id,
      subscription_id: subscriptionId,
      customer_id: customerId,
      external_session_id: studioSessionId,
    },
  });

  // Forward `activated` on EVERY delivery (incl. idempotent Stripe retries) — the
  // App de-dupes on `external_event_id` (= event.id, stable across retries). A
  // forward failure propagates (caught by POST) → non-2xx → Stripe re-delivers →
  // re-forward, giving at-least-once delivery of the state. Earnings never double
  // (confirmProposalPayment is idempotent on provider_event_id).
  const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
  await forwardMembershipLifecycle({
    event,
    proposal: activation.proposal,
    subscriptionId,
    eventKind: "activated",
    status: "active",
    currentPeriodEnd: isoFromUnixSeconds(readSubscriptionCurrentPeriodEnd(subscription)),
  });

  return NextResponse.json({
    received: true,
    handled: true,
    membership: true,
    idempotent: activation.idempotent,
    proposal_status: activation.proposal.status,
    workspace_id: activation.workspace.id,
  });
}

/**
 * Recurring lifecycle (renew / payment failed / updated / cancelled) → normalized
 * forward. State-only: ZERO earnings, no workspace re-activation.
 */
async function handleMembershipLifecycleEvent(event: Stripe.Event) {
  const stripe = getStripeClient();

  let subscriptionId: string | null = null;
  let eventKind: MembershipEventKind;
  let explicitStatus: MembershipStatus | null = null;
  let subscriptionObject: Stripe.Subscription | null = null;

  switch (event.type) {
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      subscriptionId = readInvoiceSubscriptionId(invoice);
      if (event.type === "invoice.paid") {
        // Only renewals. The FIRST invoice (activation) is handled by the
        // subscription-mode checkout.session.completed → avoids a double
        // activated/renewed for the same initial charge.
        if (invoice.billing_reason === "subscription_create") {
          return ignored(event.type, "First invoice handled by checkout.session.completed.");
        }
        if (invoice.billing_reason !== "subscription_cycle") {
          return ignored(event.type, `Unsupported invoice billing_reason "${invoice.billing_reason}".`);
        }
        eventKind = "renewed";
        explicitStatus = "active";
      } else {
        eventKind = "payment_failed";
        explicitStatus = "past_due";
      }
      break;
    }
    case "customer.subscription.updated": {
      subscriptionObject = event.data.object as Stripe.Subscription;
      subscriptionId = subscriptionObject.id;
      eventKind = "updated";
      explicitStatus = mapStripeSubscriptionStatusToWire(subscriptionObject.status);
      break;
    }
    case "customer.subscription.deleted": {
      subscriptionObject = event.data.object as Stripe.Subscription;
      subscriptionId = subscriptionObject.id;
      eventKind = "cancelled";
      explicitStatus = "ended";
      break;
    }
    default:
      return ignored(event.type, "Unsupported Stripe event type.");
  }

  if (!subscriptionId) {
    return ignored(event.type, "Event has no subscription id to correlate.");
  }

  // We need the subscription for current_period_end (+ metadata correlation
  // fallback). updated/deleted carry it on the event; invoice.* requires a fetch.
  const subscription = subscriptionObject ?? (await stripe.subscriptions.retrieve(subscriptionId));

  const proposal = await resolveMembershipProposal(
    subscriptionId,
    subscription.metadata?.external_proposal_id,
  );
  if (!proposal) {
    // Permanently unmappable (e.g. a subscription created outside this flow).
    // Ack with 200 so Stripe stops retrying instead of looping forever.
    log.warn("stripe.webhook.membership-unmapped", "No proposal mapped to subscription.", {
      subscription_id: subscriptionId,
      event_type: event.type,
    });
    return ignored(event.type, "No proposal mapped to this subscription.");
  }

  await forwardMembershipLifecycle({
    event,
    proposal,
    subscriptionId,
    eventKind,
    status: explicitStatus ?? mapStripeSubscriptionStatusToWire(subscription.status),
    currentPeriodEnd: isoFromUnixSeconds(readSubscriptionCurrentPeriodEnd(subscription)),
  });

  return NextResponse.json({
    received: true,
    handled: true,
    membership: true,
    event_kind: eventKind,
  });
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ message: "Missing Stripe signature." }, { status: 400 });
    }

    const body = await request.text();
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          if (!MEMBERSHIP_BILLING_ENABLED) {
            return ignored(event.type, "Membership billing is disabled.");
          }
          return await handleSubscriptionCheckoutCompleted(event);
        }
        return await handleCheckoutSessionCompleted(event);
      }
      case "invoice.paid":
      case "invoice.payment_failed":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        if (!MEMBERSHIP_BILLING_ENABLED) {
          return ignored(event.type, "Membership billing is disabled.");
        }
        return await handleMembershipLifecycleEvent(event);
      }
      default:
        return ignored(event.type, "Unsupported Stripe event type.");
    }
  } catch (error) {
    if (error instanceof StripeConfigError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (error instanceof PaymentActivationError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status },
      );
    }

    if (error instanceof NoonAppIntegrationError) {
      return NextResponse.json(
        { message: error.message, code: "NOON_APP_PAYMENT_HANDOFF_FAILED" },
        { status: error.status },
      );
    }

    if (error instanceof Error && error.message.toLowerCase().includes("signature")) {
      return NextResponse.json({ message: "Invalid Stripe signature." }, { status: 400 });
    }

    log.error("stripe.webhook", error);
    return NextResponse.json({ message: "Stripe webhook failed." }, { status: 500 });
  }
}
