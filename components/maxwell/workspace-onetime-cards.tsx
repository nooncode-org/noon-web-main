"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("workspace.chrome");
  return (
    <section className="rounded-[6px] border border-border bg-card">
      {/* Actions ride the title bar, hard right — same as the Domains header
          (owner 2026-07-23: "sube los botones aquí"). */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2.5">
        <h2 className="text-sm font-medium">{t("yourCode")}</h2>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              goToWorkspaceChat(t("askRepoAccess"))
            }
            className="inline-flex items-center gap-2 rounded-[6px] border border-border bg-background px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-secondary/50"
          >
            <GithubMark className="h-4 w-4" />
            Repository
          </button>
          <button
            type="button"
            onClick={() =>
              goToWorkspaceChat(t("askSourceDownload"))
            }
            className="inline-flex items-center gap-2 rounded-[6px] bg-foreground px-3.5 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Download .zip
          </button>
        </div>
      </div>
      {/* One always-visible line, not a disclosure (owner 2026-07-25): of the old
          three paragraphs only ownership said anything the two buttons didn't, so
          it's merged with the "you don't have to do anything" reassurance into a
          single subtitle. The per-button blurbs were dropped — they restated the
          Repository / Download buttons sitting right above them. */}
      <p className="max-w-3xl px-5 py-3 text-[13px] leading-relaxed text-muted-foreground">
        {t("sourceIsYours")}
      </p>
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
  const t = useTranslations("workspace.chrome");
  return (
    <section className="overflow-hidden rounded-[6px] border border-border bg-gradient-to-br from-[#0056fd]/[0.07] to-transparent p-5">
      {/* One line + the button (owner 2026-07-25): copy compressed to a single
          sentence so it sits on one row beside the CTA. "includes your hosting"
          carries the non-stacking point on its own now (the membership price
          covers hosting, so it isn't a charge ON TOP — owner model, see
          [[one-time-vs-membership-model]]); the fuller reassurance lives behind
          the button. Two bolded anchors keep the line from being a gray smear. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {delivered ? "Your project's delivered." : "Your project's being built."} Need changes
          later? A membership adds a team and{" "}
          <span className="font-medium text-foreground">includes your hosting</span>
          {monthlyAmountUsd != null && (
            <>
              {" — "}
              <span className="font-medium text-foreground">
                {formatProposalAmount(monthlyAmountUsd, currency)}/mo
              </span>
            </>
          )}
          .
        </p>
        <button
          type="button"
          onClick={() =>
            goToWorkspaceChat(t("askMembership"))
          }
          className="shrink-0 self-start rounded-[6px] bg-[#0056fd] px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0047e0] sm:self-auto"
        >
          Explore membership {"->"}
        </button>
      </div>
    </section>
  );
}
