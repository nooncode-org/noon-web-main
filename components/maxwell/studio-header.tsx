"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  CircleDashed,
  MessageSquare,
  Monitor,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
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
import { UserMenu } from "@/components/ui/user-menu";
import { siteRoutes } from "@/lib/site-config";
import { STUDIO_STATUS_META } from "@/lib/maxwell/studio-status";
import type { StudioPhase, ActiveView } from "./studio-shell";

const STUDIO_DEFAULT_LOCALE = "en";
const STUDIO_LOCALES = ["en", "es", "fr", "de"];

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
  const params = useParams();
  const rawLocale = typeof params?.locale === "string" ? params.locale : null;
  const currentLocale =
    rawLocale && STUDIO_LOCALES.includes(rawLocale) ? rawLocale : STUDIO_DEFAULT_LOCALE;
  const [draftsOpen, setDraftsOpen] = useState(false);
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
    <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-border/70 bg-background/95 px-4 py-2.5 shrink-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          href={siteRoutes.home}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label="Back to Noon"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60 text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p
            className="truncate text-[13px] font-display leading-none transition-all duration-500"
            title={displayName}
          >
            {displayName}
          </p>
          {hasWorkspace && (
            <p className="mt-1 hidden truncate text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/65 sm:block">
              {viewerEmail}
            </p>
          )}
        </div>
      </div>

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
              <span className="truncate font-medium text-foreground/90">{displayName}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-80 max-h-[min(320px,50vh)] overflow-hidden p-0">
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

        <Link
          href={agentHref}
          className="hidden items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground sm:flex"
        >
          <User className="h-3 w-3" />
          Talk to agent
        </Link>
        <button
          type="button"
          className="hidden items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground md:flex"
        >
          <Share2 className="h-3 w-3" />
          Share
        </button>
        <UserMenu
          viewer={{ email: viewerEmail, name: null, image: null }}
          locale={currentLocale}
          showStudioLink={false}
          triggerClassName="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/60 text-xs font-medium text-foreground/85 transition-colors hover:bg-background hover:text-foreground"
        />
      </div>
    </header>

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
      <AlertDialogContent>
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
