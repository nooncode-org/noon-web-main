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
  ctaLabel: string;
  /** Selectable plan → its CTA advances to the payment step with this modality. */
  selectModality?: Modality;
  /** Link CTA (e.g. the "Other" card → contact) instead of a select. */
  ctaHref?: string;
};

/**
 * Step-1 plan card — always-expanded, its CTA *selects* the plan (advancing to
 * the payment step, where the actual pay methods live). The recommended card
 * carries brand blue (#0056fd) on its border + a filled CTA.
 */
function PlanColumn({ plan, onSelect }: { plan: PlanInfo; onSelect: (modality: Modality) => void }) {
  const { name, badge, tagline, priceMain, priceSub, features, recommended } = plan;
  const ctaAccent = recommended
    ? "bg-[#0056fd] text-white hover:bg-[#0047e0]"
    : "border border-border bg-transparent text-foreground hover:bg-white/[0.06]";
  return (
    <div
      className={`flex flex-col rounded-2xl border px-7 py-12 ${
        recommended ? "border-[#0056fd] bg-[#0056fd]/[0.06]" : "border-border bg-secondary"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-medium text-foreground">{name}</span>
        {badge && (
          <span className="rounded-full bg-[#0056fd]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#0056fd]">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">{tagline}</p>
      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold leading-none text-foreground">{priceMain}</span>
        <span className="text-xs text-muted-foreground">{priceSub}</span>
      </div>
      {plan.ctaHref ? (
        <Link
          href={plan.ctaHref}
          className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-4 py-3.5 text-sm font-medium transition-colors ${ctaAccent}`}
        >
          {plan.ctaLabel}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => plan.selectModality && onSelect(plan.selectModality)}
          className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-4 py-3.5 text-sm font-medium transition-colors ${ctaAccent}`}
        >
          {plan.ctaLabel}
        </button>
      )}
      <ul className="mt-8 space-y-3.5">
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
    recommended: !hasMembership,
    ctaLabel: "Continue",
    selectModality: "one_time",
    features: [
      "Full delivery of the approved scope",
      "A single secure payment via Stripe",
      "We start the moment it clears",
    ],
  };
  const membershipPlan: PlanInfo | null =
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
      : null;
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
  const plans = [oneTimePlan, ...(membershipPlan ? [membershipPlan] : []), otherPlan];
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
        <h2 className="text-2xl font-medium text-foreground sm:text-3xl">Choose your plan</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your project starts once payment is confirmed.
        </p>
      </div>

      <div className={`mt-8 grid gap-3 ${plans.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
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
