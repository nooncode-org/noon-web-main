"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle, RotateCcw, FileText, User,
  ArrowRight, Clock, Loader2, Share2, Copy, Check,
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
   * Owner-only deep-link token to the public proposal page. Present (from the
   * session rehydrate) once a sent proposal exists; drives the "View your
   * proposal" button in the `proposal_sent` phase. Null/absent → the button is
   * hidden and the copy falls back to "check your email".
   */
  proposalToken?: string | null;
  /**
   * ADR-028 D11 — feature gate for the D-upstream wire. When `false`, the
   * "Get shareable link" CTA does not render and the
   * `prototype_shared` branch falls back to the legacy `prototype_ready`
   * surface (which can never be entered while the flag is off anyway,
   * because the Server Action short-circuits — defence in depth).
   */
  shareEnabled?: boolean;
  /** ADR-028 D10 — the Web-composed share URL when phase === "prototype_shared". */
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
  proposalToken,
  shareEnabled = false,
  shareUrl = null,
  shareUxState,
  onShare,
}: StudioProposalCtaProps) {
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
      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4">
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

  if (phase === "proposal_pending_review") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-border/70 bg-secondary text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium mb-0.5">Proposal under review</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A Noon Project Manager is reviewing this before sending it to you.
          </p>
          <Link
            href={agentHref}
            className="inline-flex items-center gap-1.5 mt-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <User className="w-3 h-3" />
            Talk to an agent directly
          </Link>
        </div>
      </div>
    );
  }

  // ── Proposal sent — client reviews + pays ─────────────────────────────────

  if (phase === "proposal_sent") {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-border/70 bg-secondary text-foreground">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium mb-0.5">Your proposal is ready</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {proposalToken
                ? "Review the formal proposal and complete payment to get started."
                : "We've emailed your proposal — check your inbox to review it and pay."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-1">
          {proposalToken ? (
            <Link
              href={`/maxwell/proposal/${proposalToken}`}
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10"
            >
              <FileText className="w-3.5 h-3.5" />
              View your proposal
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : null}
          <Link
            href={agentHref}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <User className="w-3 h-3" />
            Talk to an agent
          </Link>
        </div>
      </div>
    );
  }

  // ── Approved for proposal ─────────────────────────────────────────────────

  if (phase === "approved_for_proposal") {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
        <div>
          <p className="text-sm font-medium mb-0.5">
            Prototype approved
          </p>
          <p className="text-xs text-muted-foreground">
            Request the formal proposal — the Noon team reviews it before sending.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRequestProposal}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10"
          >
            <FileText className="w-3.5 h-3.5" />
            Request formal proposal
          </button>
          <Link
            href={agentHref}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            Talk to agent
          </Link>
        </div>
      </div>
    );
  }

  // ── Prototype shared (ADR-028 D10) ────────────────────────────────────────

  if (phase === "prototype_shared") {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-border/70 bg-secondary text-muted-foreground">
            <Share2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium mb-0.5">Shareable link ready</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Forward this link to anyone who needs to review the prototype.
            </p>
          </div>
        </div>

        {shareUrl ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Shareable link</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                aria-label="Shareable prototype link"
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
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/50">
          {canCorrect && (
            <button
              type="button"
              onClick={() => setShowCorrectionInput(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Request changes
            </button>
          )}
          <button
            type="button"
            onClick={onRequestProposal}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText className="w-3 h-3" />
            Request formal proposal
          </button>
          <Link
            href={agentHref}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <User className="w-3 h-3" />
            Talk to agent
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
      <div className="rounded-2xl border border-border/70 bg-card p-4">
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
    <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
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
          Skip to proposal
        </button>
        <Link
          href={agentHref}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <User className="w-3 h-3" />
          Talk to agent
        </Link>
      </div>
    </div>
  );
}
