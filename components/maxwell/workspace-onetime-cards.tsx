"use client";

import { GitBranch, Download } from "lucide-react";
import { goToWorkspaceChat } from "@/components/maxwell/workspace-chat";
import { formatProposalAmount } from "@/lib/maxwell/project-status-labels";

/**
 * The one-time buyer's own surfaces (owner model, 2026-07-22 — designed in the
 * wspreview `?state=onetime` playground). Shared by the mock and the real page
 * so they can't diverge.
 *
 * - WorkspaceCodePanel — its OWN "Code" tab (owner 2026-07-22: "esto debe tener
 *   su sección aparte como code"). They PAID for the build, so the source is
 *   theirs: browse/clone the repo + download the whole thing. It's also what
 *   keeps the offline policy honest — stop renewing hosting and we shut down OUR
 *   hosting, not their project.
 * - MembershipUpsellCard — an Overview card, their path to changes. Sells ongoing
 *   DEVELOPMENT (a team back on the project), NOT the chat (they already have it,
 *   as a support channel). Price is the MONTHLY ALONE: their activation (the
 *   build) is already paid, and re-charging it would bill the same thing twice.
 *
 * Both actions hand off to the Chat with the request typed (the channel that
 * actually reaches the team — same pattern as AddDomainButtons); when real repo
 * access / download / an upgrade checkout exist, they swap to direct links
 * without moving anything.
 */
export function WorkspaceCodePanel() {
  return (
    <section className="rounded-[6px] border border-border bg-card">
      <div className="border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-medium">Your code</h2>
      </div>
      <div className="p-5">
        <p className="max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          You paid for your project, so the source is yours to keep. Browse it, clone it
          to your own repository, or download the whole thing — and host it wherever you
          like, whenever you like.
        </p>

        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-[6px] border border-border">
          <li className="flex flex-wrap items-center gap-3 px-4 py-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-border bg-secondary/40">
              <GitBranch className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Repository</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Browse and clone your project&apos;s full Git history.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                goToWorkspaceChat("Hi — could you share access to my project's repository?")
              }
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border border-border bg-background px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-secondary/50"
            >
              View repository {"->"}
            </button>
          </li>

          <li className="flex flex-wrap items-center gap-3 px-4 py-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-border bg-secondary/40">
              <Download className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Source download</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                The complete codebase as a single .zip.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                goToWorkspaceChat("Hi — I'd like a download of my project's full source code.")
              }
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] bg-foreground px-3.5 py-1.5 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Download
            </button>
          </li>
        </ul>

        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground/70">
          Not sure what to do with it? Ask in the Chat — your Noon team will walk you through it.
        </p>
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
