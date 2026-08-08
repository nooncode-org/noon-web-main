"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle, RotateCcw, FileText, User,
  ArrowRight, Loader2, Share2, Copy, Check,
} from "lucide-react";
import type { StudioPhase } from "./studio-shell";
import type { PrototipoShareUxState } from "@/lib/maxwell/prototipo-share-types";

// ============================================================================
// Types
// ============================================================================

type StudioProposalCtaProps = {
  phase: StudioPhase;
  correctionsUsed: number;
  maxCorrections: number;
  onApprove: () => void;
  onRequestCorrection: (prompt: string) => void;
  onRequestProposal: () => void;
  agentHref: string;
  /**
   * ADR-028 D11 — feature gate for the D-upstream wire. When `false`, the
   * "Get shareable link" CTA does not render (defence in depth: the Server
   * Action short-circuits too).
   */
  shareEnabled?: boolean;
  /**
   * The Web-composed share URL. Sharing is an attribute, not a phase — when
   * set, the link box renders inline inside the `prototype_ready` panel.
   */
  shareUrl?: string | null;
  /** ADR-028 D8 — current UX bucket for share action lifecycle. */
  shareUxState?: PrototipoShareUxState;
  /** Fired when the seller clicks "Get shareable link". */
  onShare?: () => void;
};

// ============================================================================
// Correction input inline
// ============================================================================

function InlineCorrectionInput({
  remaining,
  onSubmit,
  onCancel,
}: {
  remaining: number;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Describe what to adjust —{" "}
        <span className="text-foreground/80">
          {remaining} {remaining === 1 ? "adjustment" : "adjustments"} remaining
        </span>
      </p>
      <div className="flex gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && value.trim()) {
              e.preventDefault();
              onSubmit(value.trim());
            }
            if (e.key === "Escape") onCancel();
          }}
          placeholder="e.g. Use a darker color scheme, add a pricing section..."
          rows={2}
          autoFocus
          className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-foreground/20 transition-colors"
        />
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => value.trim() && onSubmit(value.trim())}
            disabled={!value.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-secondary text-foreground disabled:opacity-40 transition-colors hover:bg-foreground/10"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-border text-muted-foreground hover:bg-secondary transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Share error → copy (ADR-028 D10)
// ============================================================================

function pickShareErrorCopy(state: PrototipoShareUxState | undefined): string | null {
  if (!state) return null;
  switch (state.kind) {
    case "terminal.workspace-locked":
      return "This prototype has already been finalized. Generate a new version to share again.";
    case "transient.persist-failed":
      return "Couldn't share the prototype. Try again in a moment.";
    case "transient.rate-limited":
      return "Too many attempts. Wait a minute and try again.";
    case "fatal.unknown":
      return "Unexpected error while sharing. Contact support if it persists.";
    case "idle":
    case "sharing":
    case "success":
    default:
      return null;
  }
}

// ============================================================================
// StudioProposalCta
// ============================================================================

export function StudioProposalCta({
  phase,
  correctionsUsed,
  maxCorrections,
  onApprove,
  onRequestCorrection,
  onRequestProposal,
  agentHref,
  shareEnabled = false,
  shareUrl = null,
  shareUxState,
  onShare,
}: StudioProposalCtaProps) {
  const t = useTranslations("studio");
  const [showCorrectionInput, setShowCorrectionInput] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const canCorrect = phase === "prototype_ready" && correctionsUsed < maxCorrections;
  const allUsed = correctionsUsed >= maxCorrections;
  const remaining = maxCorrections - correctionsUsed;
  const isSharing = shareUxState?.kind === "sharing";
  const shareErrorCopy = pickShareErrorCopy(shareUxState);

  async function handleCopyShareUrl(url: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      // Clipboard blocked — silently fail; the URL is visible on screen
      // and the seller can copy manually. No noisy error UX for this.
    }
  }

  // ── Generating state ──────────────────────────────────────────────────────

  if (phase === "generating_prototype" || phase === "revision_requested") {
    return (
      <div className="flex items-center gap-3 rounded-[8px] border border-border/70 bg-card p-4">
        <Loader2 className="w-4 h-4 animate-spin shrink-0 text-muted-foreground" />
        <p className="text-sm text-foreground/90">
          {phase === "generating_prototype"
            ? "Building the initial prototype..."
            : "Applying your adjustment..."}
        </p>
      </div>
    );
  }

  // ── Proposal pending review ───────────────────────────────────────────────

  // No panel here any more (owner, 2026-07-30). Two reasons, and the second is
  // the one that matters: "Proposal under review" read BACKWARDS — a client never
  // submits a proposal to us for approval, we send one to them. And by now the
  // milestone card in the conversation states the same wait in the right
  // direction, with live steps and the 15-minute expectation.
  //
  // Its two recovery actions were NOT dropped: "Resend to review" (the W10 rail
  // for a swallowed hand-off, which once stranded clients with no action at all)
  // and the agent link moved into that card, shown while it is still in progress.
  // See <StudioEventCard>.

  // ── Proposal sent — client reviews + pays ─────────────────────────────────

  // No panel here either (owner, 2026-07-30). It had been emptied one honest
  // decision at a time — first its "View your proposal" button (a second button
  // to the same page, 150px under the card's), then its headline (the card's) —
  // until what was left was a single sentence plus a copy of "Talk to an agent",
  // a link that lives permanently in the left rail. That is not enough to earn a
  // pinned strip with its own border, badge and divider.
  //
  // The sentence it did own — the proposal also went out by email — is now a note
  // on the milestone card, where the record of this proposal lives.
  //
  // Both proposal phases have now lost their panel for the same reason: the card
  // states them better and in the right place. The panel SURFACE is not obsolete
  // — prototype_ready and approved_for_proposal keep it, because there it holds
  // real actions (approve, request an adjustment, share, request the proposal).

  // ── Approved for proposal ─────────────────────────────────────────────────

  if (phase === "approved_for_proposal") {
    return (
      <div className="rounded-[8px] border border-border/70 bg-card p-4 space-y-3">
        <div>
          <p className="text-sm font-medium mb-0.5">
            Prototype approved
          </p>
          <p className="text-xs text-muted-foreground">
            {t("requestProposalBody")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRequestProposal}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10"
          >
            <FileText className="w-3.5 h-3.5" />
            {t("requestProposal")}
          </button>
          <Link
            href={agentHref}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            {t("navTalkToAgent")}
          </Link>
        </div>
      </div>
    );
  }

  // ── Prototype ready ───────────────────────────────────────────────────────

  if (phase !== "prototype_ready") return null;

  // Correction input open
  if (showCorrectionInput) {
    return (
      <div className="rounded-[8px] border border-border/70 bg-card p-4">
        <InlineCorrectionInput
          remaining={remaining}
          onSubmit={(text) => {
            setShowCorrectionInput(false);
            onRequestCorrection(text);
          }}
          onCancel={() => setShowCorrectionInput(false)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-[8px] border border-border/70 bg-card p-4 space-y-3">
      {/* Status line — the remaining-count lives on the "Request adjustment"
          badge below, so this line stays count-free and adds what approve does. */}
      <p className="text-xs text-muted-foreground">
        {allUsed
          ? "Adjustments complete — approve to move forward."
          : "Prototype ready. Approve to move toward the proposal, or request an adjustment."}
      </p>

      {/* Primary actions */}
      <div className="flex flex-wrap gap-2">
        {shareEnabled && onShare ? (
          <button
            type="button"
            onClick={onShare}
            disabled={isSharing}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10 disabled:opacity-50"
            aria-busy={isSharing}
          >
            {isSharing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            {isSharing ? "Generating link..." : "Get shareable link"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onApprove}
          className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Approve prototype
        </button>

        {canCorrect && (
          <button
            type="button"
            onClick={() => setShowCorrectionInput(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Request adjustment
            <span
              className="rounded-full border border-border/70 bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              {remaining}
            </span>
          </button>
        )}
      </div>

      {/* Shareable link — an attribute of the session, shown inline the moment
          it exists. Sharing no longer swaps this panel; the seller keeps
          Approve / Request adjustment / chat alongside the link. */}
      {shareUrl ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("shareableLink")}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              aria-label={t("shareLinkLabel")}
              className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground/85 outline-none focus:border-foreground/20"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={() => void handleCopyShareUrl(shareUrl)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground transition-colors hover:bg-foreground/10"
              aria-label={linkCopied ? "Link copied" : "Copy link"}
            >
              {linkCopied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t("copied")}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t("copy")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}

      {/* Share error surface (ADR-028 D10 copy) */}
      {shareErrorCopy ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200"
        >
          {shareErrorCopy}
        </div>
      ) : null}

      {/* Secondary actions */}
      <div className="flex flex-wrap items-center gap-3 pt-0.5 border-t border-border/50">
        <button
          type="button"
          onClick={onRequestProposal}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileText className="w-3 h-3" />
          {t("skipToProposal")}
        </button>
        <Link
          href={agentHref}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <User className="w-3 h-3" />
          {t("navTalkToAgent")}
        </Link>
      </div>
    </div>
  );
}
