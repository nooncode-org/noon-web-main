/**
 * lib/maxwell/hosting-billing.ts
 *
 * Yearly hosting for the ONE-TIME buyer (owner model 2026-07-22): they pay for
 * the BUILD once, then keep the site online with a yearly hosting fee. The
 * DOMAIN is billed separately (owner: "el dominio es aparte").
 *
 * Mechanically this reuses the membership's Option A shape verbatim — ONE Stripe
 * subscription whose first invoice also carries the one-time build line — only
 * the recurring interval is `year` instead of `month`. That means the existing
 * webhook, the Billing Portal and the `membership-lifecycle` wire all keep
 * working with no new plumbing: a lapsed hosting subscription arrives as the same
 * `status: "ended"` that already drives the App's unpublish (see
 * docs/2026-07-22-noonweb-to-app-membership-end-unpublish.md and
 * [[membership-end-policy]]).
 */

/**
 * Yearly hosting price in whole USD (owner decision 2026-07-23).
 *
 * The number is written down WITH its costing so it can be revisited with facts
 * instead of feel — prices below are the ones published in July 2026:
 *
 * - **Vercel bills per SEAT, not per project.** One Pro seat ($20/mo) hosts every
 *   client site, and its 1 TB Fast Data Transfer + 10M edge requests are a pool
 *   SHARED by all of them; a modest business site is a rounding error against
 *   that (~100 such sites fit before any overage at $0.15–0.35/GB). So the
 *   marginal hosting cost of one more client is ~$0.
 *   Note the free tier is NOT an option: Vercel restricts Hobby to
 *   non-commercial use and names "receiving payment to create, update, or host
 *   the site" as commercial.
 * - **Supabase bills per PROJECT.** $25/mo for the org plus $10/mo per project
 *   (Micro compute, first one covered by the plan credit), so a client whose
 *   site needs a database costs **$120/yr** in compute alone. Its free tier
 *   can't serve clients either — a project pauses after a week idle.
 *
 * → Marginal cost per client: ~$0/yr for a static site, ~$120/yr with a
 *   database; ~$140–205/yr fully loaded once the fixed plans are shared across
 *   5–20 clients. $300 keeps a real margin on the database case (which is what
 *   Noon actually builds — dashboards, MVPs) and pays for the part of "hosting"
 *   that isn't infrastructure: monitoring, backups, certificates, support.
 */
export const HOSTING_YEARLY_USD = 300;

/** Recurring interval for the hosting subscription line. */
export const HOSTING_INTERVAL = "year" as const;

/**
 * Kill switch for CHARGING hosting at checkout. OFF until the owner turns it on:
 * flipping it changes what a real client pays (their first hosting year is
 * billed together with the build), so it is a deliberate business action, not a
 * deploy side effect. While `false` a one-time checkout stays exactly as it is
 * today — a single `mode:"payment"` charge for the build.
 *
 * Typed `boolean` so conditions are not treated as statically known (dead-code).
 */
export const HOSTING_BILLING_ENABLED: boolean = false;

/**
 * True when this checkout should carry the recurring hosting line: a one-time
 * buyer, with the switch on. A membership already includes hosting in its
 * monthly, so it never gets one.
 */
export function shouldBillHosting(paymentModality: "one_time" | "membership"): boolean {
  return HOSTING_BILLING_ENABLED && paymentModality === "one_time";
}
