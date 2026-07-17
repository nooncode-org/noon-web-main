"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CreditCard, Loader2, Lock } from "lucide-react";
import type { ProposalStatus } from "@/lib/maxwell/repositories";
import { getContactHref, siteRoutes } from "@/lib/site-config";
import { MEMBERSHIP_BILLING_ENABLED } from "@/lib/maxwell/membership-billing";
import { AddressAutocomplete } from "@/components/maxwell/address-autocomplete";

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

// Brand marks for the payment-method rows. Inlined (no asset in the repo); these
// are placeholder marks — swap for the official brand SVGs when finalising.
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-foreground" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.9-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.78 1.3 10.32.86 1.24 1.89 2.63 3.23 2.58 1.3-.05 1.79-.83 3.36-.83 1.57 0 2.01.83 3.38.81 1.4-.03 2.28-1.26 3.13-2.51.99-1.44 1.4-2.83 1.42-2.9-.03-.01-2.72-1.04-2.75-4.14M14.6 4.44c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

// Accepted card-brand marks shown inside the card-number field (placeholder set).
function CardBrands() {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      <span className="flex h-[18px] w-7 items-center justify-center rounded bg-white text-[9px] font-bold italic tracking-tight text-[#1434cb]">
        VISA
      </span>
      <svg viewBox="0 0 32 20" className="h-[18px] w-7">
        <rect width="32" height="20" rx="3" fill="#fff" />
        <circle cx="13" cy="10" r="6" fill="#eb001b" />
        <circle cx="19" cy="10" r="6" fill="#f79e1b" />
      </svg>
      <span className="flex h-[18px] w-7 items-center justify-center rounded bg-[#1f72cd] text-[7px] font-bold tracking-tight text-white">
        AMEX
      </span>
      <span className="flex h-[18px] w-7 items-center justify-center rounded bg-white text-[5px] font-bold leading-none tracking-tight text-[#f76e11]">
        DISC<span className="text-[#231f20]">VER</span>
      </span>
    </span>
  );
}

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
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<Modality | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "apple" | "google" | "paypal">(
    "card",
  );
  const [consentChecked, setConsentChecked] = useState(false);
  // Two-step flow: pick a plan (null), then pay for it. `null` = step 1.
  const [selectedPlan, setSelectedPlan] = useState<Modality | null>(null);
  const hasApprovedAmount = approvedAmountUsd != null;
  const payable = (status === "sent" || status === "payment_pending") && hasApprovedAmount;
  const currency = approvedCurrency ?? "USD";
  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "en";
  const localeHref = (route: string) => `/${locale}${route}`;

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

  // The client just came back from a successful Stripe Checkout. The proposal
  // flips to `paid` only when the Stripe webhook reaches the App + NoonWeb, so
  // until then show a "confirming" state instead of the pay button (avoids a
  // confusing double-charge prompt during the webhook window).
  if (checkoutResult === "success") {
    return (
      <section className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-5 text-sm text-sky-950">
        <div className="flex items-start gap-3">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
          <div>
            <p className="font-medium">We&apos;re confirming your payment</p>
            <p className="mt-1 text-sky-950/80">
              Thanks! Your card payment went through. This page will update to
              &ldquo;Payment received&rdquo; once the confirmation lands — usually within a
              minute. You can refresh anytime.
            </p>
          </div>
        </div>
      </section>
    );
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

  function startCheckout(chosenModality: Modality) {
    setError(null);
    setCheckingOut(chosenModality);
    void (async () => {
      try {
        const response = await fetch("/api/maxwell/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ public_token: publicToken, payment_modality: chosenModality }),
        });
        const data = (await response.json().catch(() => null)) as {
          checkout_url?: string;
          code?: string;
          message?: string;
        } | null;

        if (response.status === 401) {
          const callbackUrl = `${window.location.pathname}${window.location.search}`;
          window.location.href = `/en/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
          return;
        }

        if (!response.ok || !data?.checkout_url) {
          throw new Error(data?.message ?? "Card payment could not be started. Please try again.");
        }

        // Hand off to Stripe Checkout. On completion Stripe redirects back to
        // `?checkout=success`; on cancel to `?checkout=cancelled`.
        window.location.href = data.checkout_url;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Card payment could not be started. Please try again.");
        setCheckingOut(null);
      }
    })();
  }

  // ── STEP 2 — pay for the chosen plan ──────────────────────────────────────
  if (chosen && selectedPlan) {
    const checkoutBusy = checkingOut !== null;
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
            onClick={() => {
              setSelectedPlan(null);
              setError(null);
            }}
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
            {/* LEFT — payment. Apple Pay express button + card form. The card
                fields are a visual placeholder; the real Stripe Payment / Express
                Checkout Element gets wired in the logic phase. */}
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-7">
              {/* Customer / billing details first, payment below — matches the
                  Claude / Stripe checkout order. */}
              <p className="text-sm font-medium text-foreground">Billing details</p>
              <div className="mt-4">
                {/* Real interactive address autocomplete (name · country · address). */}
                <AddressAutocomplete />
              </div>

              <p className="mt-7 text-sm font-medium text-foreground">Pay with</p>

              {/* Method selector — the fields below adapt to the choice. */}
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      key: "card",
                      label: "Card",
                      mark: <CreditCard className="h-5 w-5 text-foreground" strokeWidth={1.75} />,
                    },
                    { key: "apple", label: "Apple Pay", mark: <AppleMark /> },
                    { key: "google", label: "Google Pay", mark: <GoogleMark /> },
                    {
                      key: "paypal",
                      label: null,
                      mark: (
                        <span
                          className="text-sm font-bold italic leading-none tracking-tight"
                          aria-hidden="true"
                        >
                          <span style={{ color: "#0070ba" }}>Pay</span>
                          <span style={{ color: "#003087" }}>Pal</span>
                        </span>
                      ),
                    },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPaymentMethod(m.key)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                      paymentMethod === m.key
                        ? "border-[#0056fd] bg-[#0056fd]/[0.06]"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <span className="flex h-5 min-w-[24px] items-center">{m.mark}</span>
                    {m.label && (
                      <span className="text-[13px] font-medium text-foreground">{m.label}</span>
                    )}
                  </button>
                ))}
              </div>

              {paymentMethod === "card" ? (
                <>
                  {/* Card fields — visual placeholder; Stripe's real field wires in later. */}
                  <div className="mt-4 space-y-3" aria-hidden="true">
                    <div>
                      <p className="text-[13px] font-medium text-foreground">Card number</p>
                      <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-4 py-3">
                        <span className="text-sm text-muted-foreground/60">1234 1234 1234 1234</span>
                        <CardBrands />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[13px] font-medium text-foreground">Expiry date</p>
                        <div className="mt-1.5 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground/60">
                          MM / YY
                        </div>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-foreground">Security code</p>
                        <div className="mt-1.5 flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground/60">
                          <span>CVC</span>
                          <CreditCard className="h-4 w-4 text-muted-foreground/50" strokeWidth={1.75} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-2.5 text-[13px] text-muted-foreground">
                    <span
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border border-border"
                      aria-hidden="true"
                    />
                    <span>Save payment details for future purchases</span>
                  </div>
                </>
              ) : (
                <p className="mt-4 rounded-xl border border-border bg-background px-4 py-4 text-[13px] leading-relaxed text-muted-foreground">
                  You&apos;ll confirm securely with{" "}
                  <span className="font-medium text-foreground">
                    {paymentMethod === "apple"
                      ? "Apple Pay"
                      : paymentMethod === "google"
                        ? "Google Pay"
                        : "PayPal"}
                  </span>{" "}
                  when you continue.
                </p>
              )}

              <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Secure checkout · powered by Stripe
              </p>
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

              {/* Recurring-billing consent — required to subscribe to a membership. */}
              {billsMonthlyNow && (
                <label className="mt-6 flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(event) => setConsentChecked(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#0056fd]"
                  />
                  <span className="text-[11px] leading-relaxed text-muted-foreground">
                    I authorize Noon to charge {formatMoney(totalTodayUsd, currency)} today, then{" "}
                    {monthlyLabel}/month on a recurring basis until I cancel. I can cancel anytime
                    from my account.
                  </span>
                </label>
              )}

              <button
                type="button"
                onClick={() => startCheckout(selectedPlan)}
                disabled={checkoutBusy || (billsMonthlyNow && !consentChecked)}
                className={`${
                  billsMonthlyNow ? "mt-4" : "mt-6"
                } inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0056fd] px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#0047e0] disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {checkoutBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {checkoutBusy
                  ? "Redirecting to checkout…"
                  : billsMonthlyNow
                    ? "Subscribe"
                    : `Pay ${formatMoney(totalTodayUsd, currency)}`}
              </button>

              {!billsMonthlyNow && (
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/70">
                  {isMembership && monthlyLabel
                    ? `The ${monthlyLabel}/mo membership is arranged with your Noon PM. Your project starts once payment is confirmed.`
                    : "One payment, nothing recurring. Your project starts once payment is confirmed."}
                </p>
              )}

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

              {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
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
            onSelect={(modality) => {
              setSelectedPlan(modality);
              setError(null);
            }}
          />
        ))}
      </div>
    </section>
  );
}
