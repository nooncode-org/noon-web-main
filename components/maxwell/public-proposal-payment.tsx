"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import type { ProposalStatus } from "@/lib/maxwell/repositories";

type PublicProposalPaymentProps = {
  publicToken: string;
  status: ProposalStatus;
  approvedAmountUsd: number | null;
  approvedCurrency: string | null;
  checkoutState?: "success" | "cancelled" | null;
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
  checkoutState,
}: PublicProposalPaymentProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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

  if (checkoutState === "success") {
    return (
      <section className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-5 text-sm text-sky-950">
        Stripe received the payment redirect. Noon will activate the project once the signed webhook confirms it.
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
    startTransition(async () => {
      try {
        const response = await fetch("/api/maxwell/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });
        const data = (await response.json().catch(() => null)) as {
          checkout_url?: string;
          message?: string;
        } | null;

        if (!response.ok || !data?.checkout_url) {
          throw new Error(data?.message ?? "Stripe Checkout could not start.");
        }

        window.location.href = data.checkout_url;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Stripe Checkout could not start.");
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
            Secure hosted checkout by Stripe
          </p>
        </div>
        <button
          type="button"
          onClick={startCheckout}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Pay securely with Stripe
        </button>
      </div>
      {checkoutState === "cancelled" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Checkout was cancelled. You can restart the secure payment when ready.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}
