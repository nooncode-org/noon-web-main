"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, PanelLeft } from "lucide-react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { StudioSidebar } from "./studio-sidebar";
import type { StudioDraftSession } from "./studio-sidebar";
import { getContactHref } from "@/lib/site-config";
import "./studio-rd.css";

// ============================================================================
// StudioDashboard — the signed-in HOME (v0-style). Same URL as the marketing
// home (`/`), different surface: the chats hub sidebar + a launcher composer.
// It is NOT the chat — submitting the composer / opening a chat navigates to
// `/maxwell` (the conversation). Reuses <StudioSidebar> (the same panel the
// chat uses) so the two surfaces stay consistent. Self-scoped with Geist +
// `.mxw-rd` + studio-rd.css so it inherits the studio look without the
// /maxwell layout.
// ============================================================================

type SessionSummary = {
  id: string;
  initial_prompt: string;
  status: string;
  goal_summary: string | null;
  updated_at: string;
  has_client_workspace: boolean;
  proposal_public_token: string | null;
};

const STARTER_PROMPTS = [
  "A booking system for my business",
  "An internal operations dashboard",
  "A customer support AI assistant",
  "A CRM for my team",
];

export function StudioDashboard({
  viewerEmail,
  locale,
}: {
  viewerEmail: string;
  locale: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const maxwellHref = (qs = "") => `/${locale}/maxwell${qs}`;
  const agentHref = getContactHref({
    inquiry: "new-project",
    draft: input,
    source: "maxwell-dashboard-agent",
  });

  const draftSessions: StudioDraftSession[] = sessions.map((s) => ({
    id: s.id,
    title:
      (s.goal_summary || s.initial_prompt).replace(/\s+/g, " ").trim().slice(0, 88) ||
      "Conversation",
    updatedAt: s.updated_at,
    workspaceHref: s.has_client_workspace ? `/${locale}/maxwell/workspace/${s.id}` : null,
    proposalHref:
      s.proposal_public_token && !s.has_client_workspace
        ? `/${locale}/maxwell/proposal/${s.proposal_public_token}`
        : null,
  }));

  function launch() {
    const prompt = input.trim();
    router.push(prompt ? maxwellHref(`?prompt=${encodeURIComponent(prompt)}`) : maxwellHref());
  }

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

  // Shared by both sidebar mounts. quotaSnapshot is null here — it needs an
  // active session; the real quota shows inside the chat (/maxwell).
  const sidebarProps = {
    viewerEmail,
    agentHref,
    draftSessions,
    currentSessionId: null,
    onSelectDraftSession: (id: string) =>
      router.push(maxwellHref(`?session_id=${encodeURIComponent(id)}`)),
    onNewDraftChat: () => router.push(maxwellHref()),
    onDeleteDraftSession: handleDelete,
    quotaSnapshot: null,
  };

  return (
    <div
      className={`${GeistSans.variable} ${GeistMono.variable} mxw-rd flex h-[100dvh] flex-col overflow-hidden bg-background`}
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      <header className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5 shrink-0">
        {/* Mobile: open the drawer. */}
        <button
          type="button"
          onClick={() => {
            setMenuOpen(true);
            void refresh();
          }}
          aria-label="Open menu"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground lg:hidden"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        {/* Desktop: toggle the persistent rail. */}
        <button
          type="button"
          onClick={() => {
            if (!sidebarOpen) void refresh();
            setSidebarOpen((v) => !v);
          }}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={sidebarOpen}
          className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground lg:flex"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </header>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop rail — the same StudioSidebar the chat uses. */}
        {sidebarOpen && (
          <div className="hidden min-h-0 w-72 shrink-0 border-r border-border/70 lg:flex">
            <StudioSidebar
              {...sidebarProps}
              onClose={() => setSidebarOpen(false)}
              className="bg-background"
            />
          </div>
        )}

        {/* Mobile overlay drawer. */}
        <div
          className={`fixed inset-0 z-[998] transition-all duration-300 lg:hidden ${
            menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          style={{ backgroundColor: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)" }}
          onClick={() => setMenuOpen(false)}
        />
        <div
          className={`fixed top-1.5 left-1.5 bottom-1.5 z-[999] w-72 transition-all duration-300 lg:hidden ${
            menuOpen
              ? "opacity-100 translate-x-0 pointer-events-auto"
              : "opacity-0 -translate-x-full pointer-events-none"
          }`}
        >
          <StudioSidebar
            {...sidebarProps}
            onClose={() => setMenuOpen(false)}
            onNavigate={() => setMenuOpen(false)}
            className="rounded-[10px] border border-foreground/10 bg-background/95 backdrop-blur-xl shadow-2xl"
          />
        </div>

        {/* Center — the launcher composer. */}
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-16">
          <h1 className="mb-6 text-center text-2xl font-semibold text-foreground sm:text-3xl">
            What do you want to build?
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              launch();
            }}
            className="w-full max-w-2xl"
          >
            <div className="rounded-[9px] bg-[#f9f9f9] p-1.5 shadow-[0_-1px_0_0_#0000000f,-1px_0_0_0_#0000000f,1px_0_0_0_#0000000f] dark:bg-[#131313] dark:shadow-[0_-1px_0_0_#ffffff14,-1px_0_0_0_#ffffff14,1px_0_0_0_#ffffff14]">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    launch();
                  }
                }}
                placeholder="Describe what you want to build..."
                rows={3}
                className="max-h-52 min-h-[84px] w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/55"
              />
              <div className="flex items-center justify-end px-1.5 pb-1 pt-1">
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Start building"
                  className="group flex h-9 w-9 items-center justify-center rounded-full bg-[#0056FD] text-white transition-colors hover:bg-[#0047e0] disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
                </button>
              </div>
            </div>
          </form>

          {/* Starter prompts — fill the composer (edit before launching). */}
          <div className="mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-2">
            {STARTER_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setInput(p)}
                className="rounded-full border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
              >
                {p}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
