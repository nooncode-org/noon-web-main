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
 *   5–20 clients. $350 keeps a real margin on the database case (which is what
 *   Noon actually builds — dashboards, MVPs) and pays for the part of "hosting"
 *   that isn't infrastructure: monitoring, backups, certificates, support.
 *
 * The costing landed on ~$300; the list went to $350 because the yearly plan is
 * the DISCOUNTED one (see {@link HOSTING_MONTHLY_USD}) — pricing the discounted
 * option at cost-plus-nothing would have left the margin on the monthly path,
 * which is the path we don't want clients on.
 */
export const HOSTING_YEARLY_USD = 350;

/**
 * Monthly hosting price in whole USD. Paying yearly is CHEAPER on purpose —
 * "pay 10 months, get 12" (owner 2026-07-23): $35 × 12 = $420 billed monthly vs
 * $350 billed yearly, so the client saves {@link HOSTING_YEARLY_SAVING_USD}.
 *
 * The monthly premium isn't a penalty, it's the real difference: twelve charges
 * to process instead of one, a much higher chance of lapsing mid-year, and Noon
 * fronting Supabase's cost either way. The yearly plan is the one we want them
 * on, so it's the one that's discounted.
 */
export const HOSTING_MONTHLY_USD = 35;

/** What the client saves by paying yearly instead of monthly ($420 − $350). */
export const HOSTING_YEARLY_SAVING_USD = HOSTING_MONTHLY_USD * 12 - HOSTING_YEARLY_USD;

/** The two ways hosting can be billed. Yearly is the default and the cheaper one. */
export type HostingInterval = "month" | "year";

/** Recurring interval for the hosting subscription line (default = the discounted one). */
export const HOSTING_INTERVAL: HostingInterval = "year";

/** Price for a given interval, in whole USD. */
export function hostingPriceUsd(interval: HostingInterval): number {
  return interval === "month" ? HOSTING_MONTHLY_USD : HOSTING_YEARLY_USD;
}

/**
 * The FIRST hosting year is included in the build price (owner decision
 * 2026-07-23): a $4,500 project pays $4,500 at checkout — not $4,800 — and the
 * $300 starts on the anniversary. It sells better ("your project includes the
 * first year of hosting") and removes friction exactly where the client is
 * deciding to pay; the cost is $300 deferred, not lost.
 *
 * Implemented as a trial on the subscription: the recurring hosting line doesn't
 * bill until the trial ends, while the one-time BUILD line still invoices
 * immediately (Stripe cuts an invoice for one-time items at the start of a
 * trial — the standard "setup fee + trial" shape).
 *
 * ⚠️ VERIFY IN STRIPE TEST MODE BEFORE FLIPPING `HOSTING_BILLING_ENABLED`:
 * confirm the checkout charges the build TODAY and $0 of hosting. If the trial
 * ever deferred the build too, a client would receive the project without paying
 * for it — the one failure here that actually costs money.
 */
export const HOSTING_FIRST_YEAR_INCLUDED: boolean = true;

/** Trial length when the first year is included. Stripe counts plain days. */
export const HOSTING_TRIAL_DAYS = 365;

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
