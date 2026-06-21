"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import type { ProposalStatus } from "@/lib/maxwell/repositories";

type CheckoutResult = "success" | "cancelled" | null;

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
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  // Default to one-time; membership is an explicit opt-in (doc marks it
  // "Recomendado" but we don't pre-select a recurring commitment).
  const [modality, setModality] = useState<"one_time" | "membership">("one_time");
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

  function startCheckout() {
    setError(null);
    setIsStartingCheckout(true);
    void (async () => {
      try {
        const response = await fetch("/api/maxwell/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ public_token: publicToken, payment_modality: modality }),
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
        setIsStartingCheckout(false);
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

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Project activation payment</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {formatMoney(payableAmount, currency)}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure payment processed by Stripe.
          </p>
        </div>
      </div>

      {membershipApplicable && monthlyAmountUsd != null && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-foreground">Choose your plan</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setModality("one_time")}
              aria-pressed={modality === "one_time"}
              className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                modality === "one_time"
                  ? "border-foreground/40 bg-secondary/40"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="font-medium text-foreground">One-time</span>
              <span className="text-xs text-muted-foreground">
                {formatMoney(payableAmount, currency)} once
              </span>
            </button>
            <button
              type="button"
              onClick={() => setModality("membership")}
              aria-pressed={modality === "membership"}
              className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                modality === "membership"
                  ? "border-foreground/40 bg-secondary/40"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="font-medium text-foreground">Membership</span>
              <span className="text-xs text-muted-foreground">
                {formatMoney(payableAmount, currency)} + {formatMoney(monthlyAmountUsd, currency)}/mo
              </span>
            </button>
          </div>
          {modality === "membership" && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              You pay the {formatMoney(payableAmount, currency)} activation now. The{" "}
              {formatMoney(monthlyAmountUsd, currency)}/mo membership is arranged with your Noon
              PM — it isn&apos;t charged automatically yet.
            </p>
          )}
        </div>
      )}

      {checkoutResult === "cancelled" && (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          Payment was cancelled. You can try again whenever you&apos;re ready.
        </p>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={startCheckout}
          disabled={isStartingCheckout || isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isStartingCheckout ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          {isStartingCheckout ? "Redirecting to checkout…" : "Pay with card"}
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          You&apos;ll be redirected to Stripe to complete the payment securely.
        </p>
      </div>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground/70">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Paid through another channel?</p>
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
          disabled={isPending || submitted || isStartingCheckout}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {submitted ? "Evidence submitted" : "Submit payment evidence"}
        </button>
      </div>

      {submitted && (
        <p className="mt-3 text-sm text-sky-900">
          Noon received your payment evidence. The workspace activates after verification.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}
