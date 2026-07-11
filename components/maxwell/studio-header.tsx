"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  CircleDashed,
  FileText,
  LogOut,
  MessageSquare,
  Monitor,
  PanelRight,
  Plus,
  Star,
  Trash2,
  Upload,
  User,
  X,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GeistSans } from "geist/font/sans";
import { siteRoutes } from "@/lib/site-config";
import { STUDIO_STATUS_META } from "@/lib/maxwell/studio-status";
import type { StudioPhase, ActiveView } from "./studio-shell";

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

// ============================================================================
// CorrectionCounter
// ============================================================================

function CorrectionCounter({ used, max }: { used: number; max: number }) {
  const allUsed = used >= max;

  return (
    <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-mono text-muted-foreground transition-colors duration-300">
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
      className="flex lg:hidden items-center rounded-full border border-border p-0.5 text-xs"
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
}: StudioHeaderProps) {
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // B31 — Track the row staged for deletion. Single-row state is enough: the
  // AlertDialog is modal so only one delete prompt can be open at a time. We
  // keep the row's title around so the dialog can name what is being deleted
  // even after the popover closes.
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const isProcessing = phaseIsActive(phase);
  const label = phaseLabels[phase];
  const displayName = projectName || "Maxwell Studio";

  return (
    <>
    <header className="flex items-center justify-between border-b border-border/70 bg-background/95 px-4 py-2.5 shrink-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          href={siteRoutes.home}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label="Back to Noon"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
        <CircleDashed className={`h-3.5 w-3.5 ${isProcessing ? "animate-spin" : ""}`} />
        <Popover open={draftsOpen} onOpenChange={setDraftsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex max-w-[min(280px,42vw)] items-center gap-1 truncate rounded-md px-1.5 py-0.5 transition-colors hover:bg-secondary hover:text-foreground"
              title="Conversations"
            >
              <span className="shrink-0">Drafts</span>
              <span className="text-muted-foreground/50">/</span>
              <Star className="h-3 w-3 shrink-0 text-muted-foreground/70" />
              <span className="truncate font-medium text-foreground/90">{displayName}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className={`${GeistSans.className} w-80 max-h-[min(320px,50vh)] overflow-hidden p-0`}>
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
                Your chats
              </span>
              {onNewDraftChat && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftsOpen(false);
                    onNewDraftChat();
                  }}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <Plus className="h-3 w-3" />
                  New chat
                </button>
              )}
            </div>
            <ul className="max-h-[min(260px,42vh)] overflow-y-auto py-1">
              {draftSessions.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No saved conversations yet. Start a new chat or return tomorrow to pick up where you left off.
                </li>
              ) : (
                draftSessions.map((row) => {
                  const active = row.id === currentSessionId;
                  return (
                    <li
                      key={row.id}
                      className={`flex items-stretch gap-0.5 border-b border-border/40 last:border-b-0 ${
                        active ? "bg-secondary/60" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setDraftsOpen(false);
                          onSelectDraftSession?.(row.id);
                        }}
                        className="min-w-0 flex-1 px-3 py-2.5 text-left text-xs transition-colors hover:bg-secondary/80"
                      >
                        <span className="line-clamp-2 text-foreground">{row.title}</span>
                        <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground/80">
                          {row.updatedAt.slice(0, 10)}
                        </span>
                      </button>
                      {row.proposalHref && (
                        // The client's sent proposal — a <Link> (navigates)
                        // separate from the select button (loads the chat);
                        // closes the popover on click.
                        <Link
                          href={row.proposalHref}
                          aria-label="View proposal"
                          title="View proposal"
                          onClick={() => setDraftsOpen(false)}
                          className="flex w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      {row.workspaceHref && (
                        // Slice 1d (A) — re-entry to the client workspace. A
                        // <Link> (navigates) separate from the select button
                        // (loads the chat); closes the popover on click.
                        <Link
                          href={row.workspaceHref}
                          aria-label="Open workspace"
                          title="Open workspace"
                          onClick={() => setDraftsOpen(false)}
                          className="flex w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Monitor className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      {onDeleteDraftSession && (
                        // B31 — Stage the row for a confirm-dialog instead of
                        // firing the destructive action on the first click.
                        // The popover closes immediately so the dialog has the
                        // foreground and can name the row being deleted.
                        <button
                          type="button"
                          aria-label="Delete conversation"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDraftsOpen(false);
                            setPendingDelete({ id: row.id, title: row.title });
                          }}
                          className="flex w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </PopoverContent>
        </Popover>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2">
        <div className="hidden items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground lg:flex">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${isProcessing ? "animate-pulse" : ""}`}
            style={{ backgroundColor: isProcessing ? "var(--foreground)" : "var(--muted-foreground)" }}
          />
          <span className="truncate">{label}</span>
        </div>

        <ViewToggle
          activeView={activeView}
          onToggle={onToggleView}
          hasWorkspace={hasWorkspace}
        />

        {hasPrototype && (
          <CorrectionCounter used={correctionsUsed} max={maxCorrections} />
        )}

        <button
          type="button"
          aria-label="Share"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Upload className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>
    </header>

    {/* Mobile-nav-style side drawer (reused from landing/navigation.tsx so the
        studio uses the same Noon profile panel). Opens from the right. */}
    <div
      className={`fixed inset-0 z-[998] transition-all duration-300 ${
        menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      style={{ backgroundColor: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)" }}
      onClick={() => setMenuOpen(false)}
    />
    <div
      className={`fixed top-1.5 right-1.5 bottom-1.5 z-[999] w-72 transition-all duration-300 ${
        menuOpen ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-full pointer-events-none"
      }`}
    >
      <div className="h-full rounded-[10px] border border-foreground/10 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header — Noon wordmark + close */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8">
          <Link
            href={siteRoutes.home}
            className="text-base font-display tracking-tight text-foreground"
            onClick={() => setMenuOpen(false)}
          >
            noon
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center w-7 h-7 rounded-[6px] border border-foreground/10 bg-secondary/50 text-muted-foreground"
            aria-label="Close menu"
          >
            <X className="w-3.5 h-3.5" />
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

        {/* Recent chats — surfaces the conversation history here so the drawer
            is a complete panel (previously the list only lived in the breadcrumb
            popover). Same data source (draftSessions); select loads the chat. */}
        {draftSessions.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col border-t border-border/60 px-3 pt-2">
            <p className="px-4 pb-1 text-[10px] font-mono uppercase tracking-wide text-muted-foreground/80">
              Recent chats
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              {draftSessions.map((row) => {
                const active = row.id === currentSessionId;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onSelectDraftSession?.(row.id);
                    }}
                    className={`flex w-full flex-col gap-0.5 rounded-[8px] px-4 py-2.5 text-left transition-colors ${
                      active ? "bg-secondary/60" : "hover:bg-secondary/40"
                    }`}
                  >
                    <span className="line-clamp-1 text-sm text-foreground/85">{row.title}</span>
                    <span className="font-mono text-[10px] text-muted-foreground/70">
                      {row.updatedAt.slice(0, 10)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Profile section — pushed to bottom */}
        <div className="mt-auto px-4 pb-4 pt-1 space-y-3">
          <div className="rounded-[8px] border border-border/60 bg-secondary/30 px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground/80">
              Signed in as
            </p>
            <p
              className="mt-0.5 truncate text-xs font-mono text-foreground"
              title={viewerEmail}
            >
              {viewerEmail}
            </p>
          </div>
          <form action={signOutAction} onSubmit={() => setMenuOpen(false)}>
            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-border bg-background text-sm font-medium text-foreground/85 transition-colors hover:bg-secondary/60"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
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
