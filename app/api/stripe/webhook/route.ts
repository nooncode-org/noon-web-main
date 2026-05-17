import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { confirmProposalPayment, PaymentActivationError } from "@/lib/maxwell/payment-activation";
import { NoonAppIntegrationError } from "@/lib/noon-app-integration";
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

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ message: "Missing Stripe signature." }, { status: 400 });
    }

    const body = await request.text();
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());

    if (event.type !== "checkout.session.completed") {
      return ignored(event.type, "Unsupported Stripe event type.");
    }

    return await handleCheckoutSessionCompleted(event);
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
