"use client";

import { ChevronDown, Download } from "lucide-react";
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
      {/* Closed = NO text at all, just the chevron (owner 2026-07-23); the whole
          explanation — lead line included — lives inside the disclosure. Native
          <details>, the same dependency-free pattern the help menu uses. */}
      <div className="px-5 py-3">
        <details className="group">
          <summary className="-ml-1 flex w-fit cursor-pointer list-none items-center rounded-[6px] p-1 text-muted-foreground/70 transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className="h-4 w-4 transition-transform group-open:rotate-180"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="sr-only">About your code</span>
          </summary>
          <div className="mt-2 max-w-xl space-y-2 pb-2 text-[13px] leading-relaxed text-muted-foreground">
            <p>
              You paid for your project, so the source is yours to keep — and you can host it
              wherever you like, whenever you like.
            </p>
            <p className="text-[12px]">
              <span className="font-medium text-foreground/85">Repository</span> — your code on
              GitHub with its full history. Ask for access and you (or any developer) can clone
              it and keep building on it.
            </p>
            <p className="text-[12px]">
              <span className="font-medium text-foreground/85">Download .zip</span> — the whole
              codebase in one file: a backup, or a handoff to another developer or host.
            </p>
            <p className="text-[12px]">
              You don&apos;t have to do anything with it — your site keeps running with us either
              way. Not sure? Ask in the Chat and your Noon team will walk you through it.
            </p>
          </div>
        </details>
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
          {/* A membership REPLACES the standalone hosting, it isn't added to it
              (owner model — see [[one-time-vs-membership-model]]). Without this
              line the client reads the monthly as a charge ON TOP of the hosting
              they already pay, which makes the step look far more expensive than
              it is. */}
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            It <span className="font-medium text-foreground">includes your hosting</span> — you
            stop paying that separately.
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
