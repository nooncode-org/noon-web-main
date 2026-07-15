"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { StudioSidebar, type StudioDraftSession } from "./studio-sidebar";
import { getContactHref } from "@/lib/site-config";

// Mirrors the shape the studio dashboard maps from GET /api/maxwell/studio/sessions.
type SessionSummary = {
  id: string;
  goal_summary: string | null;
  initial_prompt: string;
  updated_at: string;
  has_client_workspace: boolean;
  proposal_public_token: string | null;
};

/**
 * The studio's account/chats sidebar (the same StudioSidebar the dashboard and
 * chat use) mounted on the public proposal page — a ▢ toggle top-left that opens
 * an overlay drawer. The proposal is only reachable by a signed-in viewer, so
 * this is their real studio navigation (their scoping chats, account, sign out).
 * Rendered only when a viewer exists (see the proposal page).
 */
export function ProposalSidebar({ viewerEmail, locale }: { viewerEmail: string; locale: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  async function refresh() {
    try {
      const res = await fetch("/api/maxwell/studio/sessions", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { sessions: SessionSummary[] };
      setSessions(data.sessions);
    } catch {
      // ignore — an empty/failed list just shows no recent chats.
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(
        `/api/maxwell/studio/sessions?session_id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (res.ok) void refresh();
    } catch {
      // ignore
    }
  }

  const maxwellHref = (qs = "") => `/${locale}/maxwell${qs}`;
  const agentHref = getContactHref({ inquiry: "new-project", source: "maxwell-proposal-agent" });

  const draftSessions: StudioDraftSession[] = sessions.map((s) => ({
    id: s.id,
    title:
      (s.goal_summary || s.initial_prompt).replace(/\s+/g, " ").trim().slice(0, 88) || "Conversation",
    updatedAt: s.updated_at,
    workspaceHref: s.has_client_workspace ? `/${locale}/maxwell/workspace/${s.id}` : null,
    proposalHref:
      s.proposal_public_token && !s.has_client_workspace
        ? `/${locale}/maxwell/proposal/${s.proposal_public_token}`
        : null,
  }));

  const sidebarProps = {
    viewerEmail,
    locale,
    agentHref,
    draftSessions,
    currentSessionId: null,
    onSelectDraftSession: (id: string) =>
      router.push(maxwellHref(`?session_id=${encodeURIComponent(id)}`)),
    onNewDraftChat: () => router.push(maxwellHref()),
    onDeleteDraftSession: handleDelete,
    quotaSnapshot: null,
    // The proposal page is NOT the home, so offer a Home link back to the studio.
    showHome: true,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void refresh();
        }}
        aria-label="Open menu"
        className="fixed left-3 top-3 z-40 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      {/* Overlay drawer. */}
      <div
        className={`fixed inset-0 z-[998] transition-all duration-300 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ backgroundColor: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)" }}
        onClick={() => setOpen(false)}
      />
      <div
        className={`fixed bottom-1.5 left-1.5 top-1.5 z-[999] w-72 transition-all duration-300 ${
          open
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-full opacity-0"
        }`}
      >
        <StudioSidebar
          {...sidebarProps}
          onClose={() => setOpen(false)}
          onNavigate={() => setOpen(false)}
          className="rounded-[10px] border border-foreground/10 bg-background/95 shadow-2xl backdrop-blur-xl"
        />
      </div>
    </>
  );
}
