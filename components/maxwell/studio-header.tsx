"use client";

import { useState } from "react";
import {
  ExternalLink,
  MessageSquare,
  Monitor,
  PanelLeft,
  RotateCcw,
  Smartphone,
  Star,
} from "lucide-react";
import type { PrototypeQuotaSnapshot } from "@/lib/maxwell/prototype-quota";
import { STUDIO_STATUS_META } from "@/lib/maxwell/studio-status";
import { StudioSidebar } from "./studio-sidebar";
import type { StudioDraftSession } from "./studio-sidebar";
import type { StudioPhase, ActiveView, PrototypeVersion } from "./studio-shell";

// The chats/account panel content was extracted to ./studio-sidebar (it now
// also mounts as a persistent desktop rail in the shell); the type moved with
// it. Re-exported here so existing importers keep working.
export type { StudioDraftSession } from "./studio-sidebar";

// ============================================================================
// Phase label map
// ============================================================================

const phaseLabels: Record<StudioPhase, string> = {
  intake: `${STUDIO_STATUS_META.intake.label}...`,
  clarifying: STUDIO_STATUS_META.clarifying.label,
  generating_prototype: `${STUDIO_STATUS_META.generating_prototype.label}...`,
  prototype_ready: STUDIO_STATUS_META.prototype_ready.label,
  revision_requested: `${STUDIO_STATUS_META.revision_requested.label}...`,
  revision_applied: STUDIO_STATUS_META.revision_applied.label,
  prototype_shared: STUDIO_STATUS_META.prototype_shared.label,
  approved_for_proposal: STUDIO_STATUS_META.approved_for_proposal.label,
  proposal_pending_review: STUDIO_STATUS_META.proposal_pending_review.label,
  proposal_sent: STUDIO_STATUS_META.proposal_sent.label,
  converted: "Project active",
};

const phaseIsActive = (phase: StudioPhase) =>
  phase === "generating_prototype" || phase === "revision_requested";

// Green = waiting for user input (Maxwell is done, your turn).
// White+pulse = Maxwell actively working.
// Muted = neutral / informational state.
const phaseDotColor = (phase: StudioPhase, isProcessing: boolean): string => {
  if (isProcessing) return "var(--foreground)";
  if (phase === "clarifying" || phase === "prototype_ready" || phase === "revision_applied" || phase === "prototype_shared")
    return "#22c55e"; // green-500
  return "var(--muted-foreground)";
};

// ============================================================================
// CorrectionCounter
// ============================================================================

function CorrectionCounter({ used, max }: { used: number; max: number }) {
  const allUsed = used >= max;

  return (
    <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground transition-colors duration-300">
      {allUsed ? (
        "Adjustments complete"
      ) : (
        <>
          {Array.from({ length: max }).map((_, i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full transition-colors duration-300"
              style={{ backgroundColor: i < used ? "var(--foreground)" : "var(--border)" }}
            />
          ))}
          <span className="ml-1">
            {used}/{max}
          </span>
        </>
      )}
    </div>
  );
}

// ============================================================================
// ViewToggle (mobile)
// ============================================================================

function ViewToggle({
  activeView,
  onToggle,
  hasWorkspace,
}: {
  activeView: ActiveView;
  onToggle: (v: ActiveView) => void;
  hasWorkspace: boolean;
}) {
  return (
    <div
      className="flex items-center rounded-full border border-border p-0.5 text-xs"
      style={{ backgroundColor: "var(--secondary)" }}
    >
      <button
        type="button"
        onClick={() => onToggle("chat")}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors"
        style={
          activeView === "chat"
            ? { backgroundColor: "var(--background)", color: "var(--foreground)" }
            : { color: "var(--muted-foreground)" }
        }
      >
        <MessageSquare className="w-3 h-3" />
        Chat
      </button>
      <button
        type="button"
        onClick={() => onToggle("preview")}
        disabled={!hasWorkspace}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors disabled:opacity-40"
        style={
          activeView === "preview"
            ? { backgroundColor: "var(--background)", color: "var(--foreground)" }
            : { color: "var(--muted-foreground)" }
        }
      >
        <Monitor className="w-3 h-3" />
        Preview
        {hasWorkspace && activeView !== "preview" && (
          <span className="w-1.5 h-1.5 rounded-full bg-foreground/70 animate-pulse" />
        )}
      </button>
    </div>
  );
}

// ============================================================================
// StudioHeader
// ============================================================================

type StudioHeaderProps = {
  projectName: string;
  phase: StudioPhase;
  correctionsUsed: number;
  maxCorrections: number;
  agentHref: string;
  viewerEmail: string;
  /** Current locale — forwarded to the drawer's StudioSidebar nav links. */
  locale: string;
  activeView: ActiveView;
  onToggleView: (v: ActiveView) => void;
  hasPrototype: boolean;
  hasWorkspace: boolean;
  draftSessions?: StudioDraftSession[];
  currentSessionId?: string | null;
  onSelectDraftSession?: (id: string) => void;
  onNewDraftChat?: () => void;
  onDeleteDraftSession?: (id: string) => void;
  // Re-fetch the chat list when the drawer opens. The list is loaded once on
  // mount and never retried, so a failed/slow first fetch left it empty until
  // some other action refreshed it (e.g. New chat). Refreshing on open recovers
  // from that silently-failed first load.
  onRequestChats?: () => void;
  quotaSnapshot?: PrototypeQuotaSnapshot | null;
  // Desktop rail state (lg+). The rail itself is mounted by the shell inside
  // <main>; the header only hosts the toggle button + hides the chat title
  // while the rail is open (the active row already names the chat there).
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  // Preview controls relocated from the preview pane's top strip into this
  // single header bar (v0-style). Rendered only when `hasPrototype` is true.
  previewVersions?: PrototypeVersion[];
  selectedVersionIndex?: number;
  onSelectVersion?: (index: number) => void;
  viewport?: "desktop" | "mobile";
  onViewportChange?: (v: "desktop" | "mobile") => void;
  onReloadPreview?: () => void;
};

export function StudioHeader({
  projectName,
  phase,
  correctionsUsed,
  maxCorrections,
  agentHref,
  viewerEmail,
  locale,
  activeView,
  onToggleView,
  hasPrototype,
  hasWorkspace,
  draftSessions = [],
  currentSessionId = null,
  onSelectDraftSession,
  onNewDraftChat,
  onDeleteDraftSession,
  onRequestChats,
  quotaSnapshot = null,
  sidebarOpen = false,
  onToggleSidebar,
  previewVersions = [],
  selectedVersionIndex = 0,
  onSelectVersion,
  viewport = "desktop",
  onViewportChange,
  onReloadPreview,
}: StudioHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isProcessing = phaseIsActive(phase);
  const label = phaseLabels[phase];
  const displayName = projectName || "Maxwell Studio";

  // Preview controls (relocated). The selected version drives the "Open full
  // screen" href + the compact version label. Processing/revising is shown
  // once — by the status pill on the right — so the center controls stay static.
  const previewSelectedVersion =
    previewVersions[selectedVersionIndex] ??
    previewVersions[previewVersions.length - 1] ??
    null;
  const previewUrl = previewSelectedVersion?.demoUrl ?? null;

  return (
    <>
    {/* h-14 is fixed (not content-driven) so the bottom hairline lands on the
        exact same row as the sidebar account header — keep both at h-14. */}
    <header className="flex h-14 items-center justify-between gap-2 border-b border-border/70 bg-background/95 px-4 shrink-0">
      <div className="flex min-w-0 items-center gap-2.5">
        {/* Panel trigger — one per breakpoint. Mobile opens the overlay
            drawer; desktop (lg+) toggles the persistent rail the shell mounts
            inside <main>. */}
        <button
          type="button"
          onClick={() => {
            setMenuOpen(true);
            onRequestChats?.();
          }}
          aria-label="Open menu"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground lg:hidden"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onToggleSidebar?.()}
          aria-label="Expand sidebar"
          aria-expanded={sidebarOpen}
          className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground ${
            sidebarOpen ? "lg:hidden" : "lg:flex"
          }`}
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        {/* Current chat name — plain text. Hidden on desktop while the rail is
            open (the active row already names the chat there). */}
        <div
          className={`hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex ${
            sidebarOpen ? "lg:hidden" : ""
          }`}
        >
          <Star className="h-3 w-3 shrink-0 text-muted-foreground/70" />
          <span
            className="max-w-[min(280px,42vw)] truncate font-medium text-foreground/90"
            title={displayName}
          >
            {displayName}
          </span>
        </div>
        <span
          className={`hidden h-4 w-px bg-border sm:block ${sidebarOpen ? "lg:hidden" : ""}`}
          aria-hidden="true"
        />
        <ViewToggle
          activeView={activeView}
          onToggle={onToggleView}
          hasWorkspace={hasWorkspace}
        />
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2">
        <div className="hidden items-center gap-1.5 rounded-full bg-background/60 px-3 py-1.5 text-xs text-muted-foreground lg:flex">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${isProcessing ? "animate-pulse" : ""}`}
            style={{ backgroundColor: phaseDotColor(phase, isProcessing) }}
          />
          <span className="truncate">{label}</span>
        </div>

        {hasPrototype && (
          <CorrectionCounter used={correctionsUsed} max={maxCorrections} />
        )}

        {/* Preview controls — far right of the bar. Desktop-only; shown with a
            prototype. */}
        {hasPrototype && (
          <>
            <span className="hidden h-4 w-px bg-border lg:block" aria-hidden="true" />
            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              {previewVersions.length > 1 ? (
                <div className="flex items-center gap-1">
                  {previewVersions.map((v, i) => {
                    const isSelected = i === selectedVersionIndex;
                    const isLatest = i === previewVersions.length - 1;
                    return (
                      <button
                        key={v.versionNumber}
                        type="button"
                        onClick={() => onSelectVersion?.(i)}
                        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all"
                        style={
                          isSelected
                            ? { backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }
                            : { backgroundColor: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
                        }
                      >
                        v{v.versionNumber}
                        {isLatest && (
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: isSelected ? "var(--foreground)" : "var(--muted-foreground)" }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                previewSelectedVersion && (
                  <span className="text-xs text-muted-foreground">
                    v{previewSelectedVersion.versionNumber}
                  </span>
                )
              )}

              <span className="h-4 w-px bg-border" aria-hidden="true" />

              {/* Device preview toggle — previews the iframe at mobile width */}
              <div className="flex items-center rounded-full border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => onViewportChange?.("desktop")}
                  title="Desktop preview"
                  aria-label="Desktop preview"
                  aria-pressed={viewport === "desktop"}
                  className={`flex h-6 w-7 items-center justify-center rounded-full transition-colors ${
                    viewport === "desktop" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onViewportChange?.("mobile")}
                  title="Mobile preview"
                  aria-label="Mobile preview"
                  aria-pressed={viewport === "mobile"}
                  className={`flex h-6 w-7 items-center justify-center rounded-full transition-colors ${
                    viewport === "mobile" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => onReloadPreview?.()}
                title="Reload the preview (use this if it looks blank)"
                aria-label="Reload preview"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open full screen"
                  aria-label="Open full screen"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </header>

    {/* Mobile overlay drawer (lg:hidden — on desktop the shell mounts the same
        StudioSidebar as a persistent rail inside <main>). Opens from the LEFT —
        the ▢ menu button sits on the left of the header (v0-style). */}
    <div
      className={`fixed inset-0 z-[998] transition-all duration-300 lg:hidden ${
        menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      style={{ backgroundColor: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)" }}
      onClick={() => setMenuOpen(false)}
    />
    <div
      className={`fixed top-1.5 left-1.5 bottom-1.5 z-[999] w-72 transition-all duration-300 lg:hidden ${
        menuOpen ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 -translate-x-full pointer-events-none"
      }`}
    >
      <StudioSidebar
        viewerEmail={viewerEmail}
        locale={locale}
        agentHref={agentHref}
        draftSessions={draftSessions}
        currentSessionId={currentSessionId}
        onSelectDraftSession={onSelectDraftSession}
        onNewDraftChat={onNewDraftChat}
        onDeleteDraftSession={onDeleteDraftSession}
        quotaSnapshot={quotaSnapshot}
        onClose={() => setMenuOpen(false)}
        onNavigate={() => setMenuOpen(false)}
        className="rounded-[10px] border border-foreground/10 bg-background/95 backdrop-blur-xl shadow-2xl"
      />
    </div>
    </>
  );
}
