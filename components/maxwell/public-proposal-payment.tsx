"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, CheckCircle2, ChevronDown, Loader2, UploadCloud } from "lucide-react";
import type { ProposalStatus } from "@/lib/maxwell/repositories";
import { getContactHref } from "@/lib/site-config";

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
  badge?: string;
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

export function PublicProposalPayment({
  publicToken,
  status,
  approvedAmountUsd,
  approvedCurrency,
  membershipApplicable = false,
  monthlyAmountUsd = null,
  checkoutResult = null,
}: PublicProposalPaymentProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [checkingOut, setCheckingOut] = useState<Modality | null>(null);
  // Two-step flow: pick a plan (null), then pay for it. `null` = step 1.
  const [selectedPlan, setSelectedPlan] = useState<Modality | null>(null);
  const hasApprovedAmount = approvedAmountUsd != null;
  const payable = (status === "sent" || status === "payment_pending") && hasApprovedAmount;
  const currency = approvedCurrency ?? "USD";

  if (status === "paid") {
    return (
      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-sm text-emerald-900">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Payment received</p>
            <p className="mt-1 text-emerald-900/80">
              Your project is being activated by Noon. We will continue from the approved proposal.
            </p>
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
          badge: "Recommended",
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

  function submitPaymentEvidence() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/maxwell/payment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            action: "submit_payment_evidence",
            public_token: publicToken,
            notes: notes.trim() || undefined,
          }),
        });
        const data = (await response.json().catch(() => null)) as {
          code?: string;
          message?: string;
        } | null;

        if (response.status === 401) {
          const callbackUrl = `${window.location.pathname}${window.location.search}`;
          window.location.href = `/en/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
          return;
        }

        if (!response.ok) {
          throw new Error(data?.message ?? "Payment evidence could not be submitted.");
        }

        setSubmitted(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment evidence could not be submitted.");
      }
    });
  }

  // ── STEP 2 — pay for the chosen plan ──────────────────────────────────────
  if (chosen && selectedPlan) {
    const checkoutBusy = checkingOut !== null;
    return (
      <section className="pt-12">
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

        <div className="mt-5 text-center">
          <h2 className="text-2xl font-medium text-foreground sm:text-3xl">Complete your payment</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your project starts once payment is confirmed.
          </p>
        </div>

        <div className="mx-auto mt-6 max-w-md space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-medium text-foreground">{chosen.name}</span>
                {chosen.badge && (
                  <span className="rounded-full bg-[#0056fd]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#0056fd]">
                    {chosen.badge}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{chosen.tagline}</p>
            </div>
            <span className="whitespace-nowrap text-right text-[15px] font-medium text-foreground">
              {chosen.priceMain}
              <span className="block text-[11px] font-normal text-muted-foreground">{chosen.priceSub}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => startCheckout(selectedPlan)}
            disabled={checkoutBusy || isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0056fd] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0047e0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checkoutBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            {checkoutBusy ? "Redirecting to checkout…" : "Pay with card"}
          </button>

          {checkoutResult === "cancelled" && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
              Payment was cancelled. You can try again whenever you&apos;re ready.
            </p>
          )}

          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground/70">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              Paid through another channel?
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 space-y-3">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Optional: payment reference, bank confirmation, or short note."
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/30"
              />
              <button
                type="button"
                onClick={submitPaymentEvidence}
                disabled={isPending || submitted || checkoutBusy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {submitted ? "Evidence submitted" : "Submit payment evidence"}
              </button>
            </div>
          </details>

          {submitted && (
            <p className="text-sm text-sky-900">
              Noon received your payment evidence. The workspace activates after verification.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
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
