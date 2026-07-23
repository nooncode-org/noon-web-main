"use client";

import { Download } from "lucide-react";
import { goToWorkspaceChat } from "@/components/maxwell/workspace-chat";
import { formatProposalAmount } from "@/lib/maxwell/project-status-labels";

// Official GitHub mark (Octicons "mark-github") — the repo is GitHub-hosted, so
// the button is branded, not a generic icon (owner 2026-07-22). lucide's Github
// glyph is a line-art approximation; this is the real filled mark.
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.27-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.46-.55.38A8.013 8.013 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

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
      {/* Actions ride the title bar, hard right — same as the Domains header
          (owner 2026-07-23: "sube los botones aquí"). */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2.5">
        <h2 className="text-sm font-medium">Your code</h2>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              goToWorkspaceChat("Hi — could you share access to my project's repository?")
            }
            className="inline-flex items-center gap-2 rounded-[6px] border border-border bg-background px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-secondary/50"
          >
            <GithubMark className="h-4 w-4" />
            Repository
          </button>
          <button
            type="button"
            onClick={() =>
              goToWorkspaceChat("Hi — I'd like a download of my project's full source code.")
            }
            className="inline-flex items-center gap-2 rounded-[6px] bg-foreground px-3.5 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Download .zip
          </button>
        </div>
      </div>
      <div className="p-5">
        <p className="max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          You paid for your project, so the source is yours to keep. Browse and clone the
          repository, or download the whole codebase as a .zip — and host it wherever you
          like, whenever you like.
        </p>
      </div>
      <div className="border-t border-border bg-secondary/20 px-5 py-3">
        <p className="text-[12px] leading-relaxed text-muted-foreground/70">
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
