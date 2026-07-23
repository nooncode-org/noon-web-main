"use client";

import { Code2 } from "lucide-react";
import { goToWorkspaceChat } from "@/components/maxwell/workspace-chat";
import { formatProposalAmount } from "@/lib/maxwell/project-status-labels";

/**
 * The one-time buyer's two Overview cards (owner model, 2026-07-22 — see the
 * wspreview `?state=onetime` playground where they were designed):
 *
 * - YourCodeCard — they PAID for the build, so the source is THEIRS ("muy
 *   importante que sí tenga su código"). Repository + download, covering the
 *   technical and the non-technical client. It's also what keeps the offline
 *   policy honest: stop renewing hosting and we shut down OUR hosting, not
 *   their project.
 * - MembershipUpsellCard — their path to changes. Sells ongoing DEVELOPMENT
 *   (a team back on the project), NOT the chat (they already have it, as a
 *   support/questions channel). Price is the MONTHLY ALONE: their activation
 *   (the build) is already paid, and re-charging it would bill the same thing
 *   twice.
 *
 * Shared by the mock and the real page. Today both actions hand off to the
 * Chat with the request typed (the channel that actually reaches the team —
 * same pattern as AddDomainButtons); when real repo access / download / an
 * upgrade checkout exist, these swap to direct links without moving the cards.
 */
export function YourCodeCard() {
  return (
    <section className="overflow-hidden rounded-[6px] border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-md">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
            <p className="text-sm font-medium">Your code</p>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            You own your project&apos;s full source — download it any time, or take it
            to your own repository and host it wherever you like. It&apos;s yours to keep.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() =>
              goToWorkspaceChat("Hi — could you share access to my project's repository?")
            }
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-secondary/40"
          >
            View repository {"->"}
          </button>
          <button
            type="button"
            onClick={() =>
              goToWorkspaceChat("Hi — I'd like a download of my project's full source code.")
            }
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-foreground px-3.5 py-1.5 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Download code
          </button>
        </div>
      </div>
    </section>
  );
}

export function MembershipUpsellCard({
  delivered,
  monthlyAmountUsd,
  currency,
}: {
  /** Live/delivered project → "delivered" heading; still building → honest tense. */
  delivered: boolean;
  /** The membership monthly for THIS project — shown alone, without activation. */
  monthlyAmountUsd: number | null;
  currency: string;
}) {
  return (
    <section className="overflow-hidden rounded-[6px] border border-border bg-gradient-to-br from-[#0056fd]/[0.07] to-transparent p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-md">
          <p className="text-sm font-medium">
            {delivered ? "Your project is delivered" : "Your project is being built"}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Your build is a fixed scope. Need changes or new features down the line? A
            membership puts a team back on your project — continuous development whenever
            you need it, cancel anytime.
          </p>
          {monthlyAmountUsd != null && (
            <p className="mt-2 text-[13px]">
              <span className="font-semibold text-foreground">
                {formatProposalAmount(monthlyAmountUsd, currency)}/mo
              </span>
              <span className="text-muted-foreground">
                {" "}
                · no setup fee — your build is already paid.
              </span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            goToWorkspaceChat("Hi — I'd like to add a membership to my project. How does it work?")
          }
          className="shrink-0 rounded-[6px] bg-[#0056fd] px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0047e0]"
        >
          Explore membership {"->"}
        </button>
      </div>
    </section>
  );
}
