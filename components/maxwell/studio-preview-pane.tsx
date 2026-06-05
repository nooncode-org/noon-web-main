"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Monitor, ExternalLink, CheckCircle, RotateCcw,
  FileText, User, ArrowRight, Loader2, AlertCircle, RefreshCw, Smartphone,
} from "lucide-react";
import type { StudioPhase, PrototypeVersion } from "./studio-shell";
import {
  classifyPollingPhase,
  formatElapsed,
  pollingStatusText,
} from "@/lib/maxwell/polling-progress";
import { useHasMounted } from "@/hooks/use-has-mounted";

/**
 * B28 — Contador de tiempo transcurrido mientras se polling v0.
 *
 * Re-rendea cada 1s y deriva el copy + visual treatment del helper puro
 * en `lib/maxwell/polling-progress.ts`. La fase "extended" (≥90s) cambia
 * el color del badge a amber para señalar que algo está fuera de rango
 * típico sin alarmar (no es error, solo demora).
 */
function ElapsedPollingBadge({ startedAt }: { startedAt: number }) {
  const mounted = useHasMounted();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Until hydrated, render 0 elapsed so SSR + first client paint agree. This
  // badge currently only mounts after a client-side polling action, but the
  // gate keeps it hydration-safe regardless of where it ends up rendered.
  const seconds = mounted ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const phase = classifyPollingPhase(seconds);
  const isExtended = phase === "extended";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[11px] leading-5 ${
        isExtended
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
          : "border-border/70 bg-foreground/[0.04] text-muted-foreground/90"
      }`}
    >
      <span className="truncate">{pollingStatusText(phase)}</span>
      <span className="shrink-0 font-mono tabular-nums">{formatElapsed(seconds)}</span>
    </div>
  );
}

// ============================================================================
// Placeholder — no prototype yet
// ============================================================================

function PreviewPlaceholder({
  phase,
  pollingStartedAt,
}: {
  phase: StudioPhase;
  /** B28 — timestamp (ms) cuando arrancó el polling v0; null si no estamos polling. */
  pollingStartedAt: number | null;
}) {
  const isGenerating = phase === "generating_prototype";

  if (isGenerating) {
    const steps = [
      { label: "Product direction", status: "done" },
      { label: "Prototype workspace", status: "active" },
      { label: "Interactive preview", status: "queued" },
    ];

    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/70 bg-background px-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span>Building preview</span>
          </div>
          <span className="hidden rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground sm:inline-flex">
            live workspace
          </span>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center p-5 xl:p-8">
          <div className="grid w-full max-w-5xl gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-[#070707] shadow-2xl shadow-black/30">
              <div className="flex h-10 items-center gap-2 border-b border-border/70 px-3">
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/25" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/18" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/12" />
                <div className="ml-3 h-5 flex-1 rounded-full border border-border/70 bg-background/80 px-3 text-[10px] leading-5 text-muted-foreground/60">
                  preview.noon.local
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-7">
                <div className="space-y-3">
                  <div className="h-4 w-28 rounded-full bg-foreground/12" />
                  <div className="h-9 w-4/5 rounded-xl bg-foreground/15" />
                  <div className="h-9 w-2/3 rounded-xl bg-foreground/10" />
                  <div className="h-3 w-3/4 rounded-full bg-foreground/10" />
                  <div className="h-3 w-1/2 rounded-full bg-foreground/10" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-28 rounded-2xl border border-border/70 bg-foreground/[0.06]"
                    />
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                  <div className="h-24 rounded-2xl border border-border/70 bg-foreground/[0.05]" />
                  <div className="h-24 rounded-2xl border border-border/70 bg-foreground/[0.08]" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-[#0c0c0c] p-5">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-[#131313] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Building prototype</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Maxwell is turning the conversation into a usable first version.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {steps.map((step) => (
                  <div key={step.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                    {step.status === "done" ? (
                      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-foreground/60" />
                    ) : step.status === "active" ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-foreground/60" />
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border" />
                    )}
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>

              {/*
                B28 — Counter dinámico reemplaza la barra estática previa
                (`w-2/3` hardcodeado que nunca avanzaba). Cuando el polling
                arranca, ElapsedPollingBadge muestra tiempo transcurrido +
                copy adaptativo. Si pollingStartedAt es null por algún
                motivo (race condition, action fallido antes de setear el
                state), volvemos a un mensaje neutral sin contador.
              */}
              {pollingStartedAt != null ? (
                <ElapsedPollingBadge startedAt={pollingStartedAt} />
              ) : (
                <p className="mt-3 text-[11px] leading-5 text-muted-foreground/80">
                  The preview will open here automatically when the first version is ready.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-background px-8 text-center">
      <div
        className={`w-16 h-16 rounded-2xl border border-border/70 bg-[#131313] flex items-center justify-center mb-5 text-muted-foreground transition-all duration-500 ${isGenerating ? "scale-110" : "scale-100"}`}
      >
        {isGenerating ? (
          <Loader2 className="w-7 h-7 animate-spin" />
        ) : (
          <Monitor className="w-7 h-7" />
        )}
      </div>

      <p className="text-base font-display mb-2">
        {isGenerating ? "Building prototype..." : "Preview panel"}
      </p>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        {isGenerating
          ? "Maxwell is generating an initial version based on what you've discussed. This usually takes 20–40 seconds."
          : "The interactive prototype will appear here once Maxwell has enough context to build it. Keep chatting to refine the idea."}
      </p>

      {isGenerating && (
        <div className="mt-6 flex gap-2 items-center">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="rounded-full animate-pulse transition-all duration-300"
              style={{
                backgroundColor: "var(--muted-foreground)",
                width: i === 2 ? "10px" : "6px",
                height: i === 2 ? "10px" : "6px",
                animationDelay: `${i * 150}ms`,
              }}
            />
          ))}
        </div>
      )}

      {!isGenerating && (
        <p className="text-xs text-muted-foreground mt-4 font-mono opacity-50">
          preview · waiting
        </p>
      )}
    </div>
  );
}

// ============================================================================
// PreviewFailed — prototype generation error state
// ============================================================================

function PreviewFailed({
  onRetry,
  agentHref,
}: {
  onRetry: () => void;
  agentHref: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-background px-8 text-center">
      <div
        className="w-16 h-16 rounded-2xl border border-border/70 bg-[#131313] flex items-center justify-center mb-5 text-muted-foreground"
      >
        <AlertCircle className="w-7 h-7" />
      </div>
      <p className="text-base font-display mb-2">Preview not available</p>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
        The interactive preview could not be generated right now. This is usually temporary.
        You can try again or continue chatting to refine the idea.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full bg-[#131313] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
        <Link
          href={agentHref}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors"
        >
          <User className="w-3.5 h-3.5" />
          Talk to agent
        </Link>
      </div>
      <p className="text-xs text-muted-foreground mt-6 font-mono opacity-50">
        preview · unavailable
      </p>
    </div>
  );
}

// ============================================================================
// VersionSwitcher — chips for v1, v2, v3 Current
// ============================================================================

function VersionSwitcher({
  versions,
  selectedIndex,
  onSelect,
}: {
  versions: PrototypeVersion[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  if (versions.length <= 1) return null;

  const latestIndex = versions.length - 1;

  return (
    <div className="flex items-center gap-1">
      {versions.map((v, i) => {
        const isSelected = i === selectedIndex;
        const isLatest = i === latestIndex;

        return (
          <button
            key={v.versionNumber}
            type="button"
            onClick={() => onSelect(i)}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-mono transition-all"
            style={
              isSelected
                ? { backgroundColor: "#131313", color: "var(--foreground)", border: "1px solid var(--border)" }
                : { backgroundColor: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
            }
          >
            v{v.versionNumber}
            {isLatest && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: isSelected ? "var(--foreground)" : "var(--muted-foreground)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// CorrectionInput
// ============================================================================

function CorrectionInput({
  onSubmit,
  remaining,
}: {
  onSubmit: (prompt: string) => void;
  remaining: number;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="px-4 py-3 border-t border-border">
      <p className="text-xs text-muted-foreground mb-2">
        What would you like adjusted?{" "}
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
              setValue("");
            }
          }}
          placeholder="e.g. Make the header darker, add a pricing section..."
          rows={2}
          className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50"
        />
        <button
          type="button"
          onClick={() => {
            if (value.trim()) {
              onSubmit(value.trim());
              setValue("");
            }
          }}
          disabled={!value.trim()}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#131313] text-foreground disabled:opacity-40 self-end shrink-0 transition-colors hover:bg-foreground/10"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// StudioPreviewPane
// ============================================================================

type StudioPreviewPaneProps = {
  prototypeVersions: PrototypeVersion[];
  selectedVersionIndex: number;
  onSelectVersion: (index: number) => void;
  phase: StudioPhase;
  prototypeFailed: boolean;
  correctionsUsed: number;
  maxCorrections: number;
  onApprove: () => void;
  onRequestCorrection: (prompt: string) => void;
  onRequestProposal: () => void;
  onRetryPrototype: () => void;
  agentHref: string;
  /**
   * B28 — Timestamp (Date.now ms) cuando arrancó el polling v0. Null si
   * no estamos polling. Lo setea / limpia el shell en `buildPrototype` y
   * `pollV0Status` completion/error handlers.
   */
  pollingStartedAt: number | null;
};

export function StudioPreviewPane({
  prototypeVersions,
  selectedVersionIndex,
  onSelectVersion,
  phase,
  prototypeFailed,
  correctionsUsed,
  maxCorrections,
  onApprove,
  onRequestCorrection,
  onRequestProposal,
  onRetryPrototype,
  agentHref,
  pollingStartedAt,
}: StudioPreviewPaneProps) {
  const [showCorrectionInput, setShowCorrectionInput] = useState(false);

  const currentVersion = prototypeVersions[prototypeVersions.length - 1] ?? null;
  const selectedVersion = prototypeVersions[selectedVersionIndex] ?? currentVersion;

  const canCorrect =
    phase === "prototype_ready" && correctionsUsed < maxCorrections;
  const canApprove = phase === "prototype_ready";
  const canRequestProposal = phase === "approved_for_proposal";
  const isRevising = phase === "revision_requested";
  const isPendingReview = phase === "proposal_pending_review" || phase === "proposal_sent";
  const correctionsExhausted = correctionsUsed >= maxCorrections;
  const shouldShowCorrectionInput = canApprove && showCorrectionInput;

  if (!currentVersion) {
    return (
      <div className="h-full">
        {prototypeFailed ? (
          <PreviewFailed onRetry={onRetryPrototype} agentHref={agentHref} />
        ) : (
          <PreviewPlaceholder phase={phase} pollingStartedAt={pollingStartedAt} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Preview bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b shrink-0 gap-3"
        style={{ backgroundColor: "#050505", borderColor: "var(--border)" }}
      >
        {/* Left: traffic lights + version switcher or status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>

          {isRevising ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono text-muted-foreground">Applying adjustment...</span>
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <VersionSwitcher
              versions={prototypeVersions}
              selectedIndex={selectedVersionIndex}
              onSelect={onSelectVersion}
            />
          )}

          {/* Fallback label when only one version and not revising */}
          {!isRevising && prototypeVersions.length === 1 && (
            <span className="text-xs font-mono text-muted-foreground">
              Version {currentVersion.versionNumber}
            </span>
          )}
        </div>

        {/* Right: open full screen */}
        <a
          href={selectedVersion.demoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          Open full screen
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Corrections exhausted banner */}
      {correctionsExhausted && canApprove && (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border/70 bg-[#050505] px-4 py-2.5 text-xs text-muted-foreground">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Adjustments complete — approve to move forward or request the formal proposal.</span>
        </div>
      )}

      {/* iframe (desktop) / open card (mobile) */}
      <div className="flex-1 relative overflow-hidden">
        {isRevising && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Applying adjustment...</p>
            </div>
          </div>
        )}
        {/* Desktop: sandboxed preview on a separate origin (vusercontent.net).
            allow-same-origin is required so v0's app can use sessionStorage and
            service workers on its own origin — it does not grant access to Noon. */}
        <iframe
          src={selectedVersion.demoUrl}
          className="hidden lg:block w-full h-full border-0"
          title={`Maxwell prototype version ${selectedVersion.versionNumber}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          referrerPolicy="no-referrer"
        />
        {/* Mobile: open-in-browser card */}
        <div
          className="flex lg:hidden flex-col items-center justify-center h-full px-8 text-center"
        >
          <div
            className="w-16 h-16 rounded-2xl border border-border/70 bg-[#131313] flex items-center justify-center mb-5 text-muted-foreground"
          >
            <Smartphone className="w-7 h-7" />
          </div>
          <p className="text-base font-display mb-2">
            Version {selectedVersion.versionNumber} ready
          </p>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
            The prototype opens in your browser for the best experience on mobile.
          </p>
          <a
            href={selectedVersion.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#131313] px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10"
          >
            <ExternalLink className="w-4 h-4" />
            Open prototype
          </a>
          <p className="text-xs text-muted-foreground mt-4 font-mono opacity-50">
            opens in a new tab
          </p>
        </div>
      </div>

      {/* Actions bar */}
      {(canApprove || canRequestProposal || isPendingReview) && (
        <div
          className="shrink-0 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Prototype ready — approve or adjust */}
          {canApprove && !shouldShowCorrectionInput && (
            <div
              className="flex flex-wrap items-center gap-3 px-4 py-3"
              style={{ backgroundColor: "#050505" }}
            >
              <button
                type="button"
                onClick={onApprove}
                className="inline-flex items-center gap-2 rounded-full bg-[#131313] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10"
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
                    className="rounded-full border border-border/70 bg-[#131313] px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                  >
                    {maxCorrections - correctionsUsed} left
                  </span>
                </button>
              )}

              <Link
                href={agentHref}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
              >
                <User className="w-3 h-3" />
                Talk to agent
              </Link>
            </div>
          )}

          {/* Correction input */}
          {shouldShowCorrectionInput && (
            <CorrectionInput
              remaining={maxCorrections - correctionsUsed}
              onSubmit={(prompt) => {
                setShowCorrectionInput(false);
                onRequestCorrection(prompt);
              }}
            />
          )}

          {/* Approved — request proposal */}
          {canRequestProposal && (
            <div
              className="px-4 py-4"
              style={{ backgroundColor: "#050505" }}
            >
              <p className="text-sm font-medium mb-1">
                Prototype approved
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Request the formal proposal — the Noon team reviews it before sending.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onRequestProposal}
                  className="inline-flex items-center gap-2 rounded-full bg-[#131313] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10"
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
          )}

          {/* Proposal in review */}
          {isPendingReview && (
            <div
              className="flex items-start gap-3 px-4 py-4"
              style={{ backgroundColor: "#050505" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-border/70 bg-[#131313] text-muted-foreground"
              >
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium mb-0.5">Proposal under review</p>
                <p className="text-xs text-muted-foreground">
                  A Noon Project Manager is reviewing this before sending it to you. You will receive it shortly.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
