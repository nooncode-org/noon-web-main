import { confirmProposalPayment } from "@/lib/maxwell/payment-activation";
import { log } from "@/lib/server/logger";
import { getStripeClient, getStripeObjectId } from "@/lib/stripe/server";

/**
 * Confirm a Stripe Checkout payment from the CLIENT'S return path.
 *
 * Stripe's `checkout.session.completed` webhook is a server-to-server event that
 * races with the browser landing back on the proposal page. When the browser
 * wins that race the workspace hasn't been provisioned yet, so the client would
 * briefly hit the "Preparing" fallback. This closes the gap: on the
 * `?checkout=success&session_id=cs_…` return we retrieve the session and, if it's
 * genuinely paid, confirm the payment right then — provisioning the workspace
 * before the client ever navigates to it.
 *
 * Safe to run alongside the webhook: `confirmProposalPayment` de-dupes on the
 * checkout session id (idempotency #2), so whichever path fires first wins and
 * the other is a no-op — activation, the App handoff, and the lifecycle emails
 * each happen exactly once. Best-effort by contract: the caller swallows any
 * failure and falls back to the webhook + the "confirming" state.
 *
 * SECURITY: `checkoutSessionId` arrives from a URL query param (client-supplied).
 * We retrieve the session from Stripe and require its metadata to point back at
 * THIS proposal before confirming — a mismatched or forged id can never activate
 * a proposal it doesn't belong to.
 */
export async function confirmStripeCheckoutReturn(input: {
  checkoutSessionId: string;
  proposalId: string;
}): Promise<{ confirmed: boolean; idempotent: boolean }> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(input.checkoutSessionId);

  // Only a fully completed, paid session activates. `unpaid` never does;
  // `no_payment_required` (100%-off coupons) is treated as paid.
  if (session.status !== "complete" || session.payment_status === "unpaid") {
    return { confirmed: false, idempotent: false };
  }

  // The session must belong to the proposal being viewed — the security gate for
  // the client-supplied id.
  const sessionProposalId = session.metadata?.external_proposal_id ?? session.client_reference_id;
  if (!sessionProposalId || sessionProposalId !== input.proposalId) {
    log.warn("maxwell.checkout-return", "Checkout session does not match the proposal; ignoring.", {
      proposal_id: input.proposalId,
      session_id: session.id,
    });
    return { confirmed: false, idempotent: false };
  }

  const isSubscription = session.mode === "subscription";
  const paymentIntentId = getStripeObjectId(session.payment_intent);
  const subscriptionId = getStripeObjectId(session.subscription);

  const activation = await confirmProposalPayment({
    proposalRequestId: input.proposalId,
    actor: "stripe-return",
    // Mirror the webhook's reference per mode so the App de-dupes payment-confirmed
    // on `external_payment_id` (= this reference) across both paths.
    paymentReference: isSubscription
      ? subscriptionId ?? session.id
      : paymentIntentId ?? session.id,
    summary: isSubscription
      ? "Stripe subscription activation confirmed (client return)."
      : "Stripe Checkout payment confirmed (client return).",
    provider: "stripe",
    // Distinct from the webhook's `event.id`, but idempotency #2 (the shared
    // session id) is what keeps the two paths from double-processing.
    providerEventId: `stripe-return:${session.id}`,
    providerSessionId: session.id,
    providerPaymentIntentId: paymentIntentId,
    // One-time: assert the paid amount matches the approved activation.
    // Subscription: omit — the first invoice is activation + monthly, which won't
    // match on its own (identical to the subscription webhook handler).
    paidAmountMinor: isSubscription ? undefined : session.amount_total,
    paidCurrency: session.currency,
    paidAt: new Date().toISOString(),
    providerPayload: {
      source: "stripe_checkout_return",
      checkout_session_id: session.id,
      payment_intent_id: paymentIntentId,
      subscription_id: subscriptionId,
      mode: session.mode,
      amount_total: session.amount_total,
      currency: session.currency,
      external_session_id: session.metadata?.external_session_id ?? null,
    },
  });

  return { confirmed: true, idempotent: activation.idempotent };
}
