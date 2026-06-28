/**
 * lib/maxwell/membership-billing.ts
 *
 * Shared vocabulary + flag + pure mappers for v3 Membership billing **M1**
 * (recurring charge). Pure module (no server-only imports) — safe for the
 * checkout route, the Stripe webhook, the outbound wire builder, and tests.
 *
 * Contract co-signed 2026-06-22 (docs/2026-06-22-app-to-noonweb-v3-membership-billing-cosign-response.md
 * + the NoonWeb amendment handoff). Architecture:
 * docs/2026-06-22-v3-membership-m1-architecture.md.
 *
 * Boundary recap: NoonWeb runs Stripe (subscription checkout + recurring
 * webhooks) and FORWARDS a normalized lifecycle to the App; the App is the SoT
 * of the membership state and exposes it sanitized in the project-status pull.
 * NoonWeb persists only the Stripe correlation ids (sub + customer), never the
 * client-visible state. Monthly invoices carry ZERO earnings (master-spec §24.2,
 * extended 2026-06-22) — the lifecycle wire is state-only.
 */

/**
 * M1 gate (hard deploy order, same pattern as `attachments.ts` ATTACHMENTS_ENABLED).
 *
 * ENABLED 2026-06-22: the App deployed its `membership-lifecycle` receiver (PR
 * #205 / ADR-046, migration 0098 `project_memberships` applied+verified in prod)
 * + the sanitized `membership` field on the project-status pull
 * (docs/2026-06-22-app-to-noonweb-v3-membership-billing-m1-deployed-readiness.md).
 * Kept as a kill-switch: set back to `false` to instantly fall the checkout back
 * to the M0 one-time path and stop forwarding recurring lifecycle events.
 *
 * When `false`:
 *   - Checkout ignores `payment_modality:"membership"` for the SUBSCRIPTION path
 *     and charges only the activation (`mode:"payment"`, M0 behavior). No client
 *     error — the modality is still captured.
 *   - The Stripe webhook returns `ignored` for invoice/subscription events.
 *   - The one-time `checkout.session.completed` path is UNAFFECTED.
 *
 * Operator dependency for the recurring path: the Stripe webhook endpoint must be
 * subscribed to `invoice.paid` / `invoice.payment_failed` /
 * `customer.subscription.updated` / `customer.subscription.deleted` (launch only
 * had `checkout.session.completed`). Activation works without it; renewals/
 * cancellations need it.
 *
 * Typed `boolean` so conditions are not treated as statically known (dead-code).
 */
export const MEMBERSHIP_BILLING_ENABLED: boolean = true;

/** Recurring interval for the membership subscription line. */
export const MEMBERSHIP_INTERVAL = "month" as const;

/**
 * The five lifecycle transitions NoonWeb forwards to the App. Derived from the
 * Stripe event that triggered the forward (see the webhook routing). The App
 * maps `event_kind` → its internal state transition.
 */
export type MembershipEventKind =
  | "activated"
  | "renewed"
  | "payment_failed"
  | "updated"
  | "cancelled";

/**
 * The four client-safe membership states. The App is authoritative; this is the
 * sanitized vocabulary that crosses the wire (and that the App re-exposes in the
 * pull). NoonWeb never persists this — it only forwards it.
 */
export type MembershipStatus = "active" | "past_due" | "cancelled" | "ended";

/**
 * Map a raw Stripe `Subscription.status` to the wire `MembershipStatus`. Used
 * ONLY for the `customer.subscription.updated` event, where the status is not
 * deterministic from the event type alone. The other event kinds set their
 * status explicitly (activated/renewed → active; payment_failed → past_due;
 * deleted → ended).
 *
 * Defaults to `active` for any unrecognised Stripe status so a future/odd status
 * never produces a false suspension on NoonWeb's side; the App applies its own
 * authoritative mapping on top regardless.
 */
export function mapStripeSubscriptionStatusToWire(stripeStatus: string): MembershipStatus {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return "past_due";
    case "canceled":
      return "cancelled";
    default:
      return "active";
  }
}
