"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  FileText,
  Home,
  LogOut,
  MessageSquare,
  Monitor,
  PanelLeft,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Star,
  Trash2,
  User,
} from "lucide-react";
import { signOutAction } from "@/lib/auth/signout-action";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GeistSans } from "geist/font/sans";
import type { PrototypeQuotaSnapshot } from "@/lib/maxwell/prototype-quota";
import { siteRoutes } from "@/lib/site-config";
import { STUDIO_STATUS_META } from "@/lib/maxwell/studio-status";
import type { StudioPhase, ActiveView, PrototypeVersion } from "./studio-shell";

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

export type StudioDraftSession = {
  id: string;
  title: string;
  updatedAt: string;
  // Slice 1d (A) — set when the session has a provisioned client workspace;
  // renders an "Open workspace" link on the row. Null/undefined → no link.
  workspaceHref?: string | null;
  // Set when the session's proposal is viewable + unpaid; renders a "View
  // proposal" link on the row. Null/undefined → no link.
  proposalHref?: string | null;
};

type StudioHeaderProps = {
  projectName: string;
  phase: StudioPhase;
  correctionsUsed: number;
  maxCorrections: number;
  agentHref: string;
  viewerEmail: string;
  activeView: ActiveView;
  onToggleView: (v: ActiveView) => void;
  hasPrototype: boolean;
  hasWorkspace: boolean;
  draftSessions?: StudioDraftSession[];
  currentSessionId?: string | null;
  onSelectDraftSession?: (id: string) => void;
  onNewDraftChat?: () => void;
  onDeleteDraftSession?: (id: string) => void;
  quotaSnapshot?: PrototypeQuotaSnapshot | null;
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
  activeView,
  onToggleView,
  hasPrototype,
  hasWorkspace,
  draftSessions = [],
  currentSessionId = null,
  onSelectDraftSession,
  onNewDraftChat,
  onDeleteDraftSession,
  quotaSnapshot = null,
  previewVersions = [],
  selectedVersionIndex = 0,
  onSelectVersion,
  viewport = "desktop",
  onViewportChange,
  onReloadPreview,
}: StudioHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState("");
  // B31 — Track the row staged for deletion. Single-row state is enough: the
  // AlertDialog is modal so only one delete prompt can be open at a time. We
  // keep the row's title around so the dialog can name what is being deleted
  // even after the popover closes.
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const isProcessing = phaseIsActive(phase);
  const label = phaseLabels[phase];
  const displayName = projectName || "Maxwell Studio";

  // Client-side filter for the drawer's chat search input.
  const chatQueryTrimmed = chatQuery.trim().toLowerCase();
  const filteredSessions = chatQueryTrimmed
    ? draftSessions.filter((s) => s.title.toLowerCase().includes(chatQueryTrimmed))
    : draftSessions;

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
    <header className="flex items-center justify-between gap-2 border-b border-border/70 bg-background/95 px-4 py-2.5 shrink-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        {/* Current chat name — plain text. The chat switcher now lives in the
            left drawer (v0-style), so this is no longer a dropdown. */}
        <div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
          <Star className="h-3 w-3 shrink-0 text-muted-foreground/70" />
          <span
            className="max-w-[min(280px,42vw)] truncate font-medium text-foreground/90"
            title={displayName}
          >
            {displayName}
          </span>
        </div>
        <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
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

    {/* Mobile-nav-style side drawer (reused from landing/navigation.tsx so the
        studio uses the same Noon profile panel). Opens from the LEFT — the ▢
        menu button sits on the left of the header (v0-style). */}
    <div
      className={`fixed inset-0 z-[998] transition-all duration-300 ${
        menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      style={{ backgroundColor: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)" }}
      onClick={() => setMenuOpen(false)}
    />
    <div
      className={`fixed top-1.5 left-1.5 bottom-1.5 z-[999] w-72 transition-all duration-300 ${
        menuOpen ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 -translate-x-full pointer-events-none"
      }`}
    >
      <div className="h-full rounded-[10px] border border-foreground/10 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header — account identity (avatar + email) + close, v0-style. */}
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-foreground/8">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium uppercase text-foreground">
            {viewerEmail.charAt(0) || "?"}
          </span>
          <span
            className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
            title={viewerEmail}
          >
            {viewerEmail}
          </span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center w-7 h-7 shrink-0 rounded-[6px] text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close menu"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Studio shortcuts */}
        <div className="px-3 py-3 space-y-1">
          {onNewDraftChat && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onNewDraftChat();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-3 rounded-[8px] text-sm text-foreground/85 transition-colors hover:bg-secondary/40"
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
              New chat
            </button>
          )}
          <Link
            href={agentHref}
            onClick={() => setMenuOpen(false)}
            className="flex w-full items-center gap-2.5 px-4 py-3 rounded-[8px] text-sm text-foreground/85 transition-colors hover:bg-secondary/40"
          >
            <User className="h-4 w-4 text-muted-foreground" />
            Talk to agent
          </Link>
        </div>

        {/* Chat switcher — search + recent chats, moved here from the breadcrumb
            popover so the drawer is the single v0-style panel. Same data source
            (draftSessions); the per-row actions (view proposal / open workspace /
            delete) migrated with it so nothing is lost. */}
        {draftSessions.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col border-t border-border/60 px-3 pt-3">
            <div className="relative px-1 pb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
              <input
                type="text"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                placeholder="Search chats"
                aria-label="Search chats"
                className="w-full rounded-[8px] border border-border/60 bg-secondary/30 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none"
              />
            </div>
            <p className="px-4 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground/80">
              Recent chats
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              {filteredSessions.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground/70">
                  No chats match “{chatQuery}”.
                </p>
              ) : (
                filteredSessions.map((row) => {
                  const active = row.id === currentSessionId;
                  return (
                    <div
                      key={row.id}
                      className={`flex items-stretch gap-0.5 rounded-[8px] ${
                        active ? "bg-secondary/60" : "hover:bg-secondary/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onSelectDraftSession?.(row.id);
                        }}
                        className="min-w-0 flex-1 rounded-[8px] px-4 py-2.5 text-left"
                      >
                        <span className="line-clamp-1 text-sm text-foreground/85">{row.title}</span>
                        <span className="text-[10px] text-muted-foreground/70">
                          {row.updatedAt.slice(0, 10)}
                        </span>
                      </button>
                      {row.proposalHref && (
                        <Link
                          href={row.proposalHref}
                          aria-label="View proposal"
                          title="View proposal"
                          onClick={() => setMenuOpen(false)}
                          className="flex w-9 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      {row.workspaceHref && (
                        <Link
                          href={row.workspaceHref}
                          aria-label="Open workspace"
                          title="Open workspace"
                          onClick={() => setMenuOpen(false)}
                          className="flex w-9 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Monitor className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      {onDeleteDraftSession && (
                        <button
                          type="button"
                          aria-label="Delete conversation"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(false);
                            setPendingDelete({ id: row.id, title: row.title });
                          }}
                          className="flex w-9 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Footer — quota + sign out. The account email now lives in the drawer
            header, so it isn't repeated here. */}
        <div className="mt-auto px-4 pb-4 pt-1 space-y-3">
          {/* Prototype quota — neutral/informational, not an alarm. */}
          {quotaSnapshot && (
            <div className="rounded-[8px] border border-border/60 bg-secondary/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                Prototype previews this month
              </p>
              <p className="mt-0.5 text-xs text-foreground">
                {quotaSnapshot.userDistinctSessionsWithV1ThisUtcMonth}/{quotaSnapshot.userMonthlyInitialLimit}
                <span className="ml-2 text-muted-foreground/70">
                  studio {quotaSnapshot.globalInitialPrototypesThisUtcMonth}/{quotaSnapshot.globalMonthlyInitialLimit}
                </span>
              </p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <form action={signOutAction} onSubmit={() => setMenuOpen(false)} className="flex-1">
              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-border bg-background text-sm font-medium text-foreground/85 transition-colors hover:bg-secondary/60"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
            <Link
              href={siteRoutes.home}
              onClick={() => setMenuOpen(false)}
              aria-label="Home"
              title="Home"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-border bg-background text-foreground/85 transition-colors hover:bg-secondary/60"
            >
              <Home className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>

    {/*
      B31 — Destructive-action confirmation. The popover's per-row delete
      button now stages a row into `pendingDelete`; this dialog renders only
      while a row is staged. `onOpenChange(false)` (close via X, ESC, or
      backdrop) clears the staged row without firing the destructive callback.
    */}
    <AlertDialog
      open={pendingDelete !== null}
      onOpenChange={(open) => {
        if (!open) setPendingDelete(null);
      }}
    >
      <AlertDialogContent className={GeistSans.className}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingDelete
              ? `“${pendingDelete.title}” and its draft history will be removed. This cannot be undone.`
              : "This cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pendingDelete && onDeleteDraftSession) {
                onDeleteDraftSession(pendingDelete.id);
              }
              setPendingDelete(null);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
