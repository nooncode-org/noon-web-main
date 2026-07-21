"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { AutoRefresh } from "@/components/maxwell/auto-refresh";

/**
 * useEscalated — flips to true once `afterMs` has elapsed since mount. Drives the
 * honest "this is taking longer than usual" escalation on live-waiting states:
 * a spinner that spins forever reads as broken; a status that acknowledges the
 * delay (and says what happens next) reads as alive.
 */
export function useEscalated(afterMs: number) {
  const [escalated, setEscalated] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setEscalated(true), afterMs);
    return () => clearTimeout(id);
  }, [afterMs]);
  return escalated;
}

/**
 * The body of the workspace "Preparing" page — the ONLY pre-workspace state a
 * client can land on, and only briefly. Payment (card / Apple Pay / Google Pay /
 * PayPal, all via Stripe) confirms synchronously on return, so the workspace is
 * almost always already provisioned by the time the client arrives. This covers
 * the seconds-long remnant where the browser beat the confirmation.
 *
 * It's also the client's most trust-critical moment — they just paid. So instead
 * of a lone spinner (which reads as "did it hang?"), it's a small stepper that
 * LEADS with the green "Payment confirmed" affirmation, then shows provisioning
 * actively working and the auto-open pending — the same dot vocabulary as the
 * Overview, so the wait reads as a legible pipeline. A fast auto-refresh flips to
 * the live portal the moment it lands; a slow wait escalates to an honest note.
 * (Clients who haven't paid are redirected to their proposal — never here.)
 */
export function WorkspacePreparingBody({ contactHref }: { contactHref: string }) {
  const escalated = useEscalated(75_000);
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6">
      <AutoRefresh intervalMs={4_000} />
      <div className="w-full max-w-md overflow-hidden rounded-[6px] border border-border bg-card">
        <ol className="px-5 pb-1 pt-5">
          {/* Step 1 — DONE. The emotional anchor: a just-paid client sees their
              payment acknowledged first, in green, before anything else. */}
          <li className="flex gap-3">
            <div className="flex flex-col items-center self-stretch">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
              {/* Connector = a real structural hairline in the flow (not an
                  overlay); emerald for the completed segment. */}
              <span aria-hidden className="mt-1 w-px flex-1 bg-emerald-500/40" />
            </div>
            <div className="pb-5">
              <p className="text-sm font-medium">Payment confirmed</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Your project is a go.</p>
            </div>
          </li>

          {/* Step 2 — ACTIVE (provisioning). Spinner in a blue ring; copy shifts
              to the honest "longer than usual" line once escalated. */}
          <li className="flex gap-3">
            <div className="flex flex-col items-center self-stretch">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#0056fd] bg-[#0056fd]/10">
                <Loader2
                  className="h-3 w-3 animate-spin text-[#0056fd] motion-reduce:animate-none"
                  strokeWidth={2.25}
                />
              </span>
              <span aria-hidden className="mt-1 w-px flex-1 bg-border" />
            </div>
            <div className="pb-5">
              <p className="text-sm font-medium">Setting up your workspace</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                {escalated
                  ? "Taking a little longer than usual — it's still on the way."
                  : "This usually takes just a few seconds."}
              </p>
            </div>
          </li>

          {/* Step 3 — PENDING. Sets the expectation: nothing to click, it opens
              itself. Muted hollow dot, no connector (last step). */}
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-foreground/15" />
            </span>
            <div className="pb-4">
              <p className="text-sm font-medium text-muted-foreground">
                Your workspace opens automatically
              </p>
            </div>
          </li>
        </ol>

        {/* Footer — the auto-refresh reassurance, escalating to the email safety
            net + contact link if provisioning runs long. */}
        <div className="border-t border-border bg-secondary/20 px-5 py-3">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {escalated ? (
              <>
                You&apos;ll also get an email the moment it&apos;s ready. Need a hand meanwhile?{" "}
                <a href={contactHref} className="underline underline-offset-2 hover:text-foreground">
                  Contact us
                </a>
                .
              </>
            ) : (
              "This page updates on its own the moment it's ready — no need to refresh."
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
