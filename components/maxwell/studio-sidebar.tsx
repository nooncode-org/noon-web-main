"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  FileText,
  Home,
  LayoutTemplate,
  LogOut,
  Monitor,
  PanelLeft,
  Plus,
  Rocket,
  Search,
  Trash2,
  User,
} from "lucide-react";
import { signOutAction } from "@/lib/auth/signout-action";
import { initialsOf } from "@/components/maxwell/workspace-profile-dialog";
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

// ============================================================================
// StudioSidebar — the v0-style account/chats panel.
//
// Extracted from the studio-header drawer (2026-07-13) so the SAME component
// mounts twice:
//   - Desktop (lg+): persistent rail, first flex child of the shell's <main>.
//   - Mobile: inside the header's fixed overlay drawer, as before.
// Container chrome (rounded card vs flat rail) is the mount's job via
// `className`; this component only renders the column content.
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

type StudioSidebarProps = {
  viewerEmail: string;
  /** Display name (client profile) — shown instead of the raw email when set. */
  viewerName?: string | null;
  /** Profile photo URL — replaces the initials avatar when set. */
  viewerPhotoUrl?: string | null;
  /** When provided, the header identity becomes a button that opens the
   *  profile editor (the workspace portal passes this; other mounts don't). */
  onEditProfile?: () => void;
  /** Current locale — prefixes the Templates / Upgrade nav links. */
  locale: string;
  agentHref: string;
  draftSessions?: StudioDraftSession[];
  currentSessionId?: string | null;
  onSelectDraftSession?: (id: string) => void;
  onNewDraftChat?: () => void;
  onDeleteDraftSession?: (id: string) => void;
  quotaSnapshot?: PrototypeQuotaSnapshot | null;
  /** Close/collapse the hosting panel (overlay drawer or desktop rail). */
  onClose?: () => void;
  /**
   * Fired on any navigation-ish action (row select, links, New chat). The
   * mobile overlay passes its close handler; the desktop rail passes nothing
   * (the rail stays open — the workspace auto-collapse in the shell handles
   * space when a prototype opens).
   */
  onNavigate?: () => void;
  /** Container chrome from the mount (rounded overlay card vs flat rail). */
  className?: string;
  /**
   * Footer "Home" link. From the chat it means "back to the dashboard";
   * the dashboard itself IS the home, so it passes `false` (redundant there).
   */
  showHome?: boolean;
  /**
   * Extra footer action between Sign out and Home — e.g. the client portal's
   * project-settings gear. Only the workspace mount passes this; absent
   * everywhere else (dashboard, chat, proposal), so the footer is unchanged there.
   */
  footerExtra?: ReactNode;
};

export function StudioSidebar({
  viewerEmail,
  viewerName = null,
  viewerPhotoUrl = null,
  onEditProfile,
  locale,
  agentHref,
  draftSessions = [],
  currentSessionId = null,
  onSelectDraftSession,
  onNewDraftChat,
  onDeleteDraftSession,
  quotaSnapshot = null,
  onClose,
  onNavigate,
  className = "",
  showHome = true,
  footerExtra,
}: StudioSidebarProps) {
  const [chatQuery, setChatQuery] = useState("");
  // B31 — Track the row staged for deletion. Single-row state is enough: the
  // AlertDialog is modal so only one delete prompt can be open at a time. We
  // keep the row's title around so the dialog can name what is being deleted.
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);

  // Client-side filter for the chat search input.
  const chatQueryTrimmed = chatQuery.trim().toLowerCase();
  const filteredSessions = chatQueryTrimmed
    ? draftSessions.filter((s) => s.title.toLowerCase().includes(chatQueryTrimmed))
    : draftSessions;

  // Client portal — sessions with a provisioned workspace (post-payment).
  // Derived from the same list; usually 0 or 1 entries.
  const portalRows = draftSessions.filter((s) => s.workspaceHref);

  return (
    <>
      <div className={`flex h-full min-h-0 w-full flex-col overflow-hidden ${className}`}>
        {/* Header — account identity (avatar + email) + close/collapse, v0-style.
            h-14 must match the studio header so the top hairline is one
            continuous line across the sidebar/header seam (any font/DPI). */}
        <div className="flex h-14 items-center gap-2.5 px-4 border-b border-border/70">
          {(() => {
            // Identity: display name (profile) over raw email; photo over
            // initials. Clickable → profile editor when the mount provides it.
            const displayName = viewerName?.trim() || viewerEmail;
            const avatar = viewerPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- profile photo (object URL in the mock)
              <img
                src={viewerPhotoUrl}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium uppercase text-foreground">
                {viewerName?.trim() ? initialsOf(viewerName, viewerEmail) : viewerEmail.charAt(0) || "?"}
              </span>
            );
            const nameEl = (
              <span
                className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground"
                title={viewerEmail}
              >
                {displayName}
              </span>
            );
            return onEditProfile ? (
              <button
                type="button"
                onClick={onEditProfile}
                title="Edit profile"
                className="-mx-1.5 flex min-w-0 flex-1 items-center gap-2.5 rounded-[8px] px-1.5 py-1 transition-colors hover:bg-secondary/40"
              >
                {avatar}
                {nameEl}
              </button>
            ) : (
              <>
                {avatar}
                {nameEl}
              </>
            );
          })()}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 shrink-0 rounded-md text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Collapse sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Studio shortcuts */}
        <div className="px-3 py-3 space-y-1">
          {showHome && (
            <Link
              href={siteRoutes.home}
              onClick={() => onNavigate?.()}
              className="flex w-full items-center gap-2.5 px-4 py-3 rounded-[8px] text-sm text-foreground/85 transition-colors hover:bg-secondary/40"
            >
              <Home className="h-4 w-4 text-muted-foreground" />
              Home
            </Link>
          )}
          <Link
            href={`/${locale}${siteRoutes.templates}`}
            onClick={() => onNavigate?.()}
            className="flex w-full items-center gap-2.5 px-4 py-3 rounded-[8px] text-sm text-foreground/85 transition-colors hover:bg-secondary/40"
          >
            <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
            Templates
          </Link>
          <Link
            href={`/${locale}${siteRoutes.upgrade}`}
            onClick={() => onNavigate?.()}
            className="flex w-full items-center gap-2.5 px-4 py-3 rounded-[8px] text-sm text-foreground/85 transition-colors hover:bg-secondary/40"
          >
            <Rocket className="h-4 w-4 text-muted-foreground" />
            Upgrade
          </Link>
          <Link
            href={agentHref}
            onClick={() => onNavigate?.()}
            className="flex w-full items-center gap-2.5 px-4 py-3 rounded-[8px] text-sm text-foreground/85 transition-colors hover:bg-secondary/40"
          >
            <User className="h-4 w-4 text-muted-foreground" />
            Talk to agent
          </Link>
          {onNewDraftChat && (
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                onNewDraftChat();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-3 rounded-[8px] text-sm text-foreground/85 transition-colors hover:bg-secondary/40"
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
              New chat
            </button>
          )}
        </div>

        {/* Client portal — the live project workspace(s), post-payment. More
            prominent than the chats list: it's the client's active project. */}
        {portalRows.length > 0 && (
          <div className="border-t border-border/60 px-3 pt-3 pb-2">
            <p className="px-4 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground/80">
              Client portal
            </p>
            {portalRows.map((row) => (
              <Link
                key={row.id}
                href={row.workspaceHref!}
                onClick={() => onNavigate?.()}
                className="flex items-center gap-2.5 rounded-[8px] px-4 py-2.5 text-sm text-foreground/85 transition-colors hover:bg-secondary/40"
              >
                <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="line-clamp-1">{row.title}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Chat switcher — search + recent chats. Same data source as always
            (draftSessions); per-row actions (view proposal / open workspace /
            delete) live on each row. */}
        {draftSessions.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col border-t border-border/60 px-3 pt-3">
            <div className="px-1 pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  type="text"
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  placeholder="Search chats"
                  aria-label="Search chats"
                  className="w-full rounded-[8px] border border-border/60 bg-secondary/30 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none"
                />
              </div>
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
                          onNavigate?.();
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
                          onClick={() => onNavigate?.()}
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
                          onClick={() => onNavigate?.()}
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
                            onNavigate?.();
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

        {/* Footer — quota + sign out. The account email lives in the header
            above, so it isn't repeated here. */}
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
            <form action={signOutAction} onSubmit={() => onNavigate?.()} className="flex-1">
              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-border bg-background text-sm font-medium text-foreground/85 transition-colors hover:bg-secondary/60"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
            {footerExtra}
          </div>
        </div>
      </div>

      {/*
        B31 — Destructive-action confirmation. The per-row delete button stages
        a row into `pendingDelete`; this dialog renders only while a row is
        staged. `onOpenChange(false)` (close via X, ESC, or backdrop) clears the
        staged row without firing the destructive callback.
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
