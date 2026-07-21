"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Lock } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import type { ProposalStatus } from "@/lib/maxwell/repositories";
import { getContactHref, siteRoutes } from "@/lib/site-config";
import { MEMBERSHIP_BILLING_ENABLED } from "@/lib/maxwell/membership-billing";
import { AutoRefresh } from "@/components/maxwell/auto-refresh";
import { useEscalated } from "@/components/maxwell/workspace-preparing-body";

// Stripe.js loads once per module. The publishable key is public by design (it
// ships to the browser); when it's unset — e.g. before the owner configures it —
// `stripePromise` stays null and the payment step shows a graceful fallback.
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

type CheckoutResult = "success" | "cancelled" | null;
type Modality = "one_time" | "membership";

type PublicProposalPaymentProps = {
  publicToken: string;
  status: ProposalStatus;
  approvedAmountUsd: number | null;
  approvedCurrency: string | null;
  /**
   * v3 membership (M0). When the engine recommends membership for this project
   * AND a monthly is available, the client can pick "Membership" vs "One-time".
   * The activation (`approvedAmountUsd`) is charged either way; the monthly is
   * NOT charged here (arranged manually by the PM until M1). Defaults keep the
   * one-time-only behaviour for projects where membership doesn't apply.
   */
  membershipApplicable?: boolean;
  monthlyAmountUsd?: number | null;
  /**
   * Set from the `?checkout=success|cancelled` query param Stripe appends when
   * it redirects back from Checkout (see `success_url` / `cancel_url` in
   * `app/api/maxwell/checkout/route.ts`). `success` means the card was charged;
   * the proposal flips to `paid` asynchronously once the Stripe webhook lands,
   * so we show a "confirming" state until then.
   */
  checkoutResult?: CheckoutResult;
  /** Studio session id — links the post-payment CTA to the client's project workspace (the portal). */
  studioSessionId?: string;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

type PlanInfo = {
  key: string;
  name: string;
  tagline: string;
  priceMain: string;
  priceSub: string;
  features: string[];
  recommended: boolean;
  /** Membership when the engine doesn't offer it → rendered disabled, not selectable. */
  unavailable?: boolean;
  ctaLabel: string;
  /** Selectable plan → its CTA advances to the payment step with this modality. */
  selectModality?: Modality;
  /** Link CTA (e.g. the "Other" card → contact) instead of a select. */
  ctaHref?: string;
};

/**
 * Step-1 plan card — a filled price panel up top (name pill + big price, a
 * brand-blue gradient on the recommended plan) over the tagline, CTA, and
 * feature checklist. Its CTA *selects* the plan (advancing to the payment step).
 */
// Animated wash for the recommended card: two blurred colour blobs that drift
// slowly inside the price panel (clipped by its rounded box). Motion is gentle
// and pauses under prefers-reduced-motion.
const PPW_WASH_CSS = `
.ppw-blob{position:absolute;border-radius:9999px;filter:blur(34px);will-change:transform}
.ppw-blob-blue{width:72%;height:96%;top:-26%;right:-12%;background:radial-gradient(circle,rgba(0,86,253,.55),transparent 70%);animation:ppw-drift-a 15s ease-in-out infinite}
.ppw-blob-purple{width:66%;height:88%;top:-18%;left:14%;background:radial-gradient(circle,rgba(124,58,237,.5),transparent 70%);animation:ppw-drift-b 19s ease-in-out infinite}
@keyframes ppw-drift-a{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-7%,7%) scale(1.09)}}
@keyframes ppw-drift-b{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(9%,-4%) scale(1.12)}}
@media (prefers-reduced-motion:reduce){.ppw-blob{animation:none}}
`;

function PlanColumn({ plan, onSelect }: { plan: PlanInfo; onSelect: (modality: Modality) => void }) {
  const { name, tagline, priceMain, priceSub, features, recommended, unavailable } = plan;
  const ctaAccent = recommended
    ? "bg-[#0056fd] text-white hover:bg-[#0047e0]"
    : "bg-foreground text-background hover:bg-foreground/90";
  const ctaClass = `inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-medium transition-colors ${ctaAccent}`;
  const cta = unavailable ? (
    <span
      aria-disabled
      className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-full bg-foreground/10 px-4 py-3 text-sm font-medium text-muted-foreground"
    >
      {plan.ctaLabel}
    </span>
  ) : plan.ctaHref ? (
    <Link href={plan.ctaHref} className={ctaClass}>
      {plan.ctaLabel}
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => plan.selectModality && onSelect(plan.selectModality)}
      className={ctaClass}
    >
      {plan.ctaLabel}
    </button>
  );
  return (
    <div
      className={`flex flex-col rounded-2xl border border-border bg-card p-2.5 pb-10 ${
        unavailable ? "opacity-55" : ""
      }`}
    >
      {/* Price panel — name up top; price + CTA down at the bottom. The
          recommended card carries the blue→purple wash contained inside this
          box (the rounded border-box clips it); the others keep a plain fill. */}
      <div className="relative flex min-h-[248px] flex-col justify-between overflow-hidden rounded-xl bg-foreground/[0.05] px-6 pt-7 pb-4">
        {recommended && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <span className="ppw-blob ppw-blob-blue" />
            <span className="ppw-blob ppw-blob-purple" />
            <style>{PPW_WASH_CSS}</style>
          </div>
        )}
        <div className="relative flex items-center justify-between gap-3">
          <span className="text-[15px] font-medium text-foreground">{name}</span>
          {recommended && (
            <span className="rounded-full bg-[#141414] px-2.5 py-1 text-[11px] font-medium text-foreground">
              Popular
            </span>
          )}
          {unavailable && (
            <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Unavailable
            </span>
          )}
        </div>
        <div className="relative">
          {unavailable ? (
            <span className="text-lg font-medium text-muted-foreground">Not available</span>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-semibold leading-none text-foreground">{priceMain}</span>
              {priceSub && <span className="text-xs text-muted-foreground">{priceSub}</span>}
            </div>
          )}
          <div className="-mx-3 mt-5">{cta}</div>
        </div>
      </div>

      <p className="mt-6 px-1.5 text-[13px] text-muted-foreground">{tagline}</p>

      <ul className="mt-6 space-y-3.5 px-1.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-[13px] text-muted-foreground">
            <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[#0056fd]" strokeWidth={2.5} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Live "confirming payment" state (a-lo-Vercel: status that updates itself, and
 * an honest escalation instead of an endless spinner). Reaching it means the
 * server-side confirm-on-return didn't land on this render (e.g. a transient
 * Stripe API miss) and the webhook is finishing the job. Each `router.refresh()`
 * tick re-runs the page server-side — which RETRIES the confirm, so this state
 * actively self-heals rather than just waiting. The 7s interval keeps a
 * comfortable margin inside the proposal page's 30 req/60s per-IP rate budget.
 */
function ConfirmingPaymentBox() {
  const escalated = useEscalated(75_000);
  return (
    <section className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-5 text-sm text-sky-950">
      <AutoRefresh intervalMs={7_000} />
      <div className="flex items-start gap-3">
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
        <div>
          <p className="font-medium">
            {escalated ? "Still confirming your payment" : "We're confirming your payment"}
          </p>
          {escalated ? (
            <p className="mt-1 text-sky-950/80">
              This is taking longer than usual — but your payment went through and nothing is
              lost. This page keeps checking on its own, and we&apos;ll also email you the
              moment your project is confirmed. Need a hand?{" "}
              <a href={getContactHref()} className="underline underline-offset-2">
                Contact us
              </a>
              .
            </p>
          ) : (
            <p className="mt-1 text-sky-950/80">
              Thanks — your payment went through. This page updates on its own; confirmation
              usually lands in a few seconds.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function PublicProposalPayment({
  publicToken,
  status,
  approvedAmountUsd,
  approvedCurrency,
  membershipApplicable = false,
  monthlyAmountUsd = null,
  checkoutResult = null,
  studioSessionId,
}: PublicProposalPaymentProps) {
  // Two-step flow: pick a plan (null), then pay for it. `null` = step 1.
  const [selectedPlan, setSelectedPlan] = useState<Modality | null>(null);
  const hasApprovedAmount = approvedAmountUsd != null;
  const payable = (status === "sent" || status === "payment_pending") && hasApprovedAmount;
  const currency = approvedCurrency ?? "USD";
  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "en";
  const localeHref = (route: string) => `/${locale}${route}`;

  // Embedded Checkout asks for the session's client secret when it mounts. This
  // POSTs to our checkout route (which creates or reuses the Stripe session for
  // the chosen modality) and hands back its client_secret. A 401 means the viewer
  // must sign in first — we bounce there and never resolve (the page navigates).
  const fetchClientSecret = useCallback(async () => {
    const response = await fetch("/api/maxwell/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        public_token: publicToken,
        payment_modality: selectedPlan ?? undefined,
      }),
    });
    if (response.status === 401) {
      const callbackUrl = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/${locale}/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      return new Promise<string>(() => {});
    }
    const data = (await response.json().catch(() => null)) as
      | { client_secret?: string; message?: string }
      | null;
    if (!response.ok || !data?.client_secret) {
      throw new Error(data?.message ?? "Payment could not be started. Please try again.");
    }
    return data.client_secret;
  }, [publicToken, selectedPlan, locale]);

  if (status === "paid") {
    const wasMembership = membershipApplicable && monthlyAmountUsd != null;
    const paidTotal =
      wasMembership && monthlyAmountUsd != null && MEMBERSHIP_BILLING_ENABLED
        ? (approvedAmountUsd ?? 0) + monthlyAmountUsd
        : approvedAmountUsd ?? 0;
    // Post-payment the client lands in their project portal (the workspace) —
    // where status, versions, materials and billing all live. Falls back to the
    // studio home if we somehow don't have the session id.
    const projectHref = studioSessionId
      ? localeHref(`/maxwell/workspace/${studioSessionId}`)
      : localeHref(siteRoutes.maxwellStudio);
    return (
      <section className="pt-12">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid md:grid-cols-2">
            {/* LEFT — confirmation + CTA */}
            <div className="flex flex-col items-center justify-center p-8 text-center sm:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" strokeWidth={2.5} />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-foreground">Payment successful</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your project is confirmed — Noon is activating it now. We&apos;ll continue from the
                approved proposal.
              </p>
              <Link
                href={projectHref}
                className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0056fd] px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#0047e0]"
              >
                Go to your project
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {wasMembership
                  ? "Track progress, previews, and billing — all from your project workspace."
                  : "Track progress and previews from your project workspace."}
              </p>
            </div>

            {/* RIGHT — receipt */}
            <div className="border-t border-border bg-foreground/[0.03] p-8 sm:p-10 md:border-l md:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Receipt</p>
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Paid
                </span>
              </div>

              <div className="mt-5 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="text-foreground">
                    {wasMembership ? "Membership" : "One-time project"}
                  </span>
                </div>
                {approvedAmountUsd != null && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {wasMembership ? "Activation" : "Project payment"}
                    </span>
                    <span className="text-foreground">
                      {formatMoney(approvedAmountUsd, currency)}
                    </span>
                  </div>
                )}
                {wasMembership && monthlyAmountUsd != null && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Membership</span>
                    <span className="text-foreground">
                      {formatMoney(monthlyAmountUsd, currency)}/mo
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-sm font-medium text-foreground">Total paid</span>
                <span className="text-lg font-semibold text-foreground">
                  {formatMoney(paidTotal, currency)}
                </span>
              </div>

              <p className="mt-4 truncate text-[11px] text-muted-foreground/70">Ref: {publicToken}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (status === "expired") {
    return (
      <section className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 text-sm text-amber-900">
        This proposal expired. Ask Noon for a refreshed quote before paying.
      </section>
    );
  }

  if (status === "payment_under_verification") {
    return (
      <section className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-5 text-sm text-sky-950">
        Payment is under verification. The project will activate once the payment is confirmed.
      </section>
    );
  }

  // The client just came back from a successful Stripe Checkout. The server
  // already tried confirm-on-return before rendering; still being here means
  // that path didn't land yet, so show a LIVE confirming state instead of the
  // pay button (avoids a confusing double-charge prompt during the window).
  if (checkoutResult === "success") {
    return <ConfirmingPaymentBox />;
  }

  if (!payable) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Payment is not available for this proposal yet. Noon must approve and publish a final USD amount first.
      </section>
    );
  }

  const payableAmount = approvedAmountUsd;
  if (payableAmount == null) return null;

  const hasMembership = membershipApplicable && monthlyAmountUsd != null;

  const oneTimePlan: PlanInfo = {
    key: "one_time",
    name: "One-time",
    tagline: "One payment, nothing recurring",
    priceMain: formatMoney(payableAmount, currency),
    priceSub: "once",
    recommended: false,
    ctaLabel: "Continue",
    selectModality: "one_time",
    features: [
      "Full delivery of the approved scope",
      "A single secure payment via Stripe",
      "We start the moment it clears",
    ],
  };
  const membershipPlan: PlanInfo =
    hasMembership && monthlyAmountUsd != null
      ? {
          key: "membership",
          name: "Membership",
          tagline: "Activation now, plus ongoing monthly",
          priceMain: formatMoney(payableAmount, currency),
          priceSub: `activation + ${formatMoney(monthlyAmountUsd, currency)}/mo`,
          recommended: true,
          ctaLabel: "Continue",
          selectModality: "membership",
          features: [
            "Everything in one-time, plus:",
            "Ongoing improvements after your project ships",
            "A monthly retainer for changes and new work",
            "Set with your Noon PM — never charged automatically",
          ],
        }
      : {
          // Engine didn't recommend membership for this project → the card stays
          // in place (the 3-up layout never shifts) but renders disabled.
          key: "membership",
          name: "Membership",
          tagline: "Not offered for this project's scope",
          priceMain: "",
          priceSub: "",
          recommended: false,
          unavailable: true,
          ctaLabel: "Not available",
          features: [
            "Ongoing improvements after your project ships",
            "A monthly retainer for changes and new work",
            "Set with your Noon PM — never charged automatically",
          ],
        };
  const otherPlan: PlanInfo = {
    key: "other",
    name: "Other",
    tagline: "Something else in mind?",
    priceMain: "Custom",
    priceSub: "",
    recommended: false,
    ctaLabel: "Contact us",
    ctaHref: getContactHref(),
    features: [
      "A different scope, budget, or timeline",
      "Questions before you commit",
      "Prefer to talk it through first",
    ],
  };
  const plans = [oneTimePlan, membershipPlan, otherPlan];
  const chosen =
    selectedPlan === "membership" ? membershipPlan : selectedPlan === "one_time" ? oneTimePlan : null;

  // ── STEP 2 — pay for the chosen plan ──────────────────────────────────────
  if (chosen && selectedPlan) {
    const isMembership = selectedPlan === "membership";
    // M1 (billing live) bills activation + first month up front, then recurs.
    // Kill-switch back to M0 → activation only, monthly arranged by the PM.
    const billsMonthlyNow =
      isMembership && monthlyAmountUsd != null && MEMBERSHIP_BILLING_ENABLED;
    const totalTodayUsd =
      billsMonthlyNow && monthlyAmountUsd != null
        ? payableAmount + monthlyAmountUsd
        : payableAmount;
    const monthlyLabel = monthlyAmountUsd != null ? formatMoney(monthlyAmountUsd, currency) : null;
    return (
      <section className="pt-12">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => setSelectedPlan(null)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Change plan
          </button>

          <div className="mt-5">
            <h2 className="text-2xl font-medium text-foreground sm:text-3xl">Complete your payment</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your project starts once payment is confirmed.
            </p>
          </div>

          {/* Desktop: payment (left) + plan summary sidebar (right). Stacks on mobile. */}
          <div className="mt-8 grid items-start gap-6 md:grid-cols-[3fr_2fr]">
            {/* LEFT — Stripe Embedded Checkout. Stripe renders the real card and
                wallet fields, collects the billing address, and owns the Pay /
                Subscribe button inside its own widget: one charge, no redirect,
                PCI-safe. `key={selectedPlan}` remounts it if the client goes back
                and switches plans, so it re-fetches the matching session. */}
            <div className="min-h-[440px] overflow-hidden rounded-2xl border border-border bg-white">
              {stripePromise ? (
                <EmbeddedCheckoutProvider
                  key={selectedPlan}
                  stripe={stripePromise}
                  options={{ fetchClientSecret }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              ) : (
                <div className="flex min-h-[440px] flex-col items-center justify-center gap-2 p-8 text-center">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Online payment isn&apos;t available yet
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    Please contact Noon and we&apos;ll help you complete your payment.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT — plan summary sidebar: features, price breakdown, pay CTA. */}
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xl font-medium text-foreground">{chosen.name}</p>
                {isMembership && (
                  <span className="shrink-0 rounded-full bg-[#141414] px-2.5 py-1 text-[11px] font-medium text-foreground">
                    Popular
                  </span>
                )}
              </div>

              {chosen.features.length > 0 && (
                <ul className="mt-5 space-y-3.5">
                  {chosen.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-[13px] text-muted-foreground"
                    >
                      <Check className="mt-[3px] h-4 w-4 shrink-0 text-[#0056fd]" strokeWidth={2.5} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6 space-y-2.5 border-t border-border pt-6 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {isMembership ? "Activation" : "Project payment"}
                  </span>
                  <span className="text-foreground">{formatMoney(payableAmount, currency)}</span>
                </div>
                {isMembership && monthlyLabel && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Membership</span>
                    <span className="text-foreground">{monthlyLabel}/mo</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">VAT (0%)</span>
                  <span className="text-foreground">{formatMoney(0, currency)}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-base font-medium text-foreground">Total due today</span>
                <span className="text-xl font-semibold text-foreground">
                  {formatMoney(totalTodayUsd, currency)}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground/60">Amounts in {currency}.</p>

              {billsMonthlyNow && monthlyLabel && (
                <p className="mt-5 rounded-xl border border-border bg-background px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
                  You authorize {formatMoney(totalTodayUsd, currency)} today, then {monthlyLabel}/month
                  on a recurring basis until you cancel — you confirm it on the secure Stripe form to
                  the left. Cancel anytime from your account.
                </p>
              )}

              {!billsMonthlyNow && (
                <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground/70">
                  {isMembership && monthlyLabel
                    ? `The ${monthlyLabel}/mo membership is arranged with your Noon PM. Your project starts once payment is confirmed.`
                    : "One payment, nothing recurring. Your project starts once payment is confirmed."}
                </p>
              )}

              <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" />
                Secure checkout · powered by Stripe
              </p>

              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/60">
                By continuing you agree to Noon&apos;s{" "}
                <Link
                  href={localeHref(siteRoutes.termsAndConditions)}
                  className="underline underline-offset-2 hover:text-muted-foreground"
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href={localeHref(siteRoutes.privacyPolicy)}
                  className="underline underline-offset-2 hover:text-muted-foreground"
                >
                  Privacy Policy
                </Link>
                .
              </p>

              {checkoutResult === "cancelled" && (
                <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                  Payment was cancelled. You can try again whenever you&apos;re ready.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── STEP 1 — choose a plan ────────────────────────────────────────────────
  return (
    <section className="pt-12">
      <div className="text-center">
        <h2 className="text-2xl font-medium text-foreground sm:text-3xl">Choose an option</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your project starts once payment is confirmed.
        </p>
      </div>

      <div className={`mt-8 grid gap-6 ${plans.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {plans.map((plan) => (
          <PlanColumn
            key={plan.key}
            plan={plan}
            onSelect={(modality) => setSelectedPlan(modality)}
          />
        ))}
      </div>
    </section>
  );
}
