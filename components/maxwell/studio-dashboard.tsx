"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowUp,
  FileText,
  Github,
  Globe,
  Mic,
  PanelLeft,
  Plus,
  TriangleIcon,
  Upload,
  X,
} from "lucide-react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { StudioSidebar } from "./studio-sidebar";
import type { StudioDraftSession } from "./studio-sidebar";
import type { AttachedFile } from "./studio-shell";
import { getContactHref } from "@/lib/site-config";
import "./studio-rd.css";

// ============================================================================
// StudioDashboard — the signed-in HOME (v0-style). Same URL as the marketing
// home (`/`), different surface: the chats hub sidebar + a launcher composer.
// It is NOT the chat — submitting the composer / opening a chat navigates to
// `/maxwell` (the conversation). Attachments ride the same sessionStorage
// handoff the marketing hero uses (`maxwell_attached_file`, consumed by
// StudioShell on the first message). Reuses <StudioSidebar> (the same panel
// the chat uses) so the two surfaces stay consistent. Self-scoped with Geist
// + `.mxw-rd` + studio-rd.css so it inherits the studio look without the
// /maxwell layout.
// ============================================================================

type Suggestion = { label: string; prompt: string };

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
  // Same rotating-suggestion source as the marketing hero composer.
  const t = useTranslations("hero");
  const suggestions = t.raw("suggestions") as Suggestion[];
  const [input, setInput] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState(0);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  // Launcher opens with the rail COLLAPSED — the composer is the focus; the
  // panel button (top-left) reopens it. (The chat surface still opens with its
  // rail expanded, where navigation matters more.)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Attach affordance — same UX as the marketing hero / chat composer.
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [urlInputMode, setUrlInputMode] = useState<"github" | "vercel" | "image" | null>(null);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [urlInputLoading, setUrlInputLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

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

  // Rotate the placeholder suggestion every 4s (matches the hero composer).
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSuggestion((prev) => (prev + 1) % suggestions.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [suggestions.length]);

  // Close the attach menu on click-outside (ported from the hero composer).
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
        setUrlInputMode(null);
        setUrlInputValue("");
      }
    }
    if (attachMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [attachMenuOpen]);

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFile({ name: file.name, mimeType: file.type, dataUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    } else if (
      file.type.startsWith("text/") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".json")
    ) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFile({ name: file.name, mimeType: file.type, dataUrl: "", textContent: reader.result as string });
      };
      reader.readAsText(file);
    } else {
      setAttachedFile({ name: file.name, mimeType: file.type, dataUrl: "" });
    }
  }

  async function handleUrlImport() {
    if (!urlInputValue.trim()) return;
    setUrlInputLoading(true);
    try {
      if (urlInputMode === "github") {
        const match = urlInputValue.match(/github\.com\/([^/]+\/[^/]+)/);
        const repo = match ? match[1].replace(/\.git$/, "") : urlInputValue;
        const apiUrl = `https://api.github.com/repos/${repo}/readme`;
        const res = await fetch(apiUrl, { headers: { Accept: "application/vnd.github.raw+json" } });
        if (res.ok) {
          const text = await res.text();
          setAttachedFile({ name: `${repo} (README.md)`, mimeType: "text/plain", dataUrl: "", textContent: text.slice(0, 8000) });
        } else {
          setAttachedFile({ name: `GitHub: ${repo}`, mimeType: "text/plain", dataUrl: "" });
        }
      } else if (urlInputMode === "vercel") {
        setAttachedFile({ name: `Vercel: ${urlInputValue}`, mimeType: "text/plain", dataUrl: "", textContent: `Vercel project URL: ${urlInputValue}` });
      } else if (urlInputMode === "image") {
        setAttachedFile({ name: urlInputValue, mimeType: "image/url", dataUrl: urlInputValue });
      }
    } catch {
      setAttachedFile({ name: urlInputValue, mimeType: "text/plain", dataUrl: "" });
    } finally {
      setUrlInputLoading(false);
      setAttachMenuOpen(false);
      setUrlInputMode(null);
      setUrlInputValue("");
    }
  }

  function launch() {
    const prompt = input.trim();
    if (!prompt && !attachedFile) return;

    // Same handoff as the marketing hero: StudioShell consumes this key on
    // the first message of a fresh session.
    if (attachedFile) {
      try {
        sessionStorage.setItem("maxwell_attached_file", JSON.stringify(attachedFile));
      } catch {
        // sessionStorage full or unavailable
      }
    }
    const effectivePrompt =
      prompt || (attachedFile ? `I've attached a file: ${attachedFile.name}` : "");
    router.push(maxwellHref(`?prompt=${encodeURIComponent(effectivePrompt)}`));
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
    locale,
    agentHref,
    draftSessions,
    currentSessionId: null,
    onSelectDraftSession: (id: string) =>
      router.push(maxwellHref(`?session_id=${encodeURIComponent(id)}`)),
    onNewDraftChat: () => router.push(maxwellHref()),
    onDeleteDraftSession: handleDelete,
    quotaSnapshot: null,
    // The dashboard IS the home — a Home link here would point at itself.
    showHome: false,
  };

  return (
    <div
      className={`${GeistSans.variable} ${GeistMono.variable} mxw-rd relative flex h-[100dvh] overflow-hidden bg-background`}
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      {/* Open affordance — floats top-left. Mobile: opens the drawer. Desktop:
          only shown when the rail is collapsed (reopen). When the rail is open
          the sidebar's own button collapses it, so there's a single panel icon
          at a time — no duplicate toggles. */}
      <button
        type="button"
        onClick={() => {
          setMenuOpen(true);
          void refresh();
        }}
        aria-label="Open menu"
        className="absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground lg:hidden"
      >
        <PanelLeft className="h-4 w-4" />
      </button>
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => {
            void refresh();
            setSidebarOpen(true);
          }}
          aria-label="Expand sidebar"
          className="absolute left-3 top-3 z-20 hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground lg:flex"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}

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
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
          <h1 className="mb-6 text-center text-[1.375rem] leading-[1.1] tracking-tight text-foreground sm:text-[1.625rem] lg:text-[1.875rem]">
            {t("headline")}
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              launch();
            }}
            className="w-full max-w-2xl"
          >
            <div className="rounded-[9px] bg-[#f9f9f9] p-1.5 shadow-[0_-1px_0_0_#0000000f,-1px_0_0_0_#0000000f,1px_0_0_0_#0000000f] dark:bg-[#131313] dark:shadow-[0_-1px_0_0_#ffffff14,-1px_0_0_0_#ffffff14,1px_0_0_0_#ffffff14]">
              <div className="relative min-w-0 overflow-hidden">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      launch();
                    }
                  }}
                  placeholder={isInputFocused ? t("placeholder") : ""}
                  rows={3}
                  aria-label={t("placeholder")}
                  className="max-h-52 min-h-[106px] lg:min-h-[102px] w-full resize-none bg-transparent px-3 py-1.5 text-[16px] leading-relaxed text-foreground outline-none placeholder:text-[#a3a3a3]/50 text-left lg:px-3.5 lg:text-[15px]"
                />
                {!input && !isInputFocused && (
                  // Rotating suggestion — matches the textarea's font-size and
                  // padding exactly so there's no visual jump between the
                  // default / focus / typing states (ported from the hero).
                  <div className="pointer-events-none absolute left-0 right-0 top-0 overflow-hidden px-3 py-1.5 lg:px-3.5">
                    <span
                      key={currentSuggestion}
                      className="animate-fade-in block w-full truncate whitespace-nowrap text-left text-[16px] leading-relaxed text-[#a3a3a3]/50 lg:text-[15px]"
                    >
                      {suggestions[currentSuggestion]?.prompt}
                    </span>
                  </div>
                )}
              </div>

              {/* Attached file badge (same chip as the hero/chat composers). */}
              {attachedFile && (
                <div className="px-1.5 pb-1">
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-foreground">
                    <span className="truncate">{attachedFile.name}</span>
                    <button
                      type="button"
                      aria-label="Remove attachment"
                      onClick={() => setAttachedFile(null)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              )}

              {/* Bottom row — attach menu (left) + send (right), same as the
                  hero/chat composers. */}
              <div className="mt-1 flex items-center justify-between gap-2 px-1.5 pb-1 pt-1">
                <div className="relative" ref={attachMenuRef}>
                  <input ref={fileInputRef} type="file" accept="image/*,.txt,.md,.csv,.json,.doc,.docx" className="hidden" onChange={handleFileChange} />
                  <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                  <button
                    type="button"
                    aria-label="Add"
                    onClick={() => {
                      setAttachMenuOpen((v) => !v);
                      setUrlInputMode(null);
                      setUrlInputValue("");
                    }}
                    className="flex h-8 w-8 items-center justify-center text-foreground transition-opacity hover:opacity-70"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  {attachMenuOpen && (
                    <div className="liquid-glass-card absolute bottom-10 left-0 z-50 w-52 overflow-hidden rounded-[10px]">
                      {!urlInputMode ? (
                        <div className="py-1">
                          <button type="button" disabled title="Voice input is not available yet." className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground/60">
                            <Mic className="h-4 w-4 text-muted-foreground/60" />
                            Voice input
                          </button>
                          <div className="my-1 h-px bg-border" />
                          <button type="button" onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-secondary">
                            <Upload className="h-4 w-4 text-muted-foreground" />
                            Upload file
                          </button>
                          <button type="button" onClick={() => { pdfInputRef.current?.click(); setAttachMenuOpen(false); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-secondary">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            Upload PDF
                          </button>
                          <div className="my-1 h-px bg-border" />
                          <button type="button" onClick={() => setUrlInputMode("github")} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-secondary">
                            <Github className="h-4 w-4 text-muted-foreground" />
                            Import from GitHub
                          </button>
                          <button type="button" onClick={() => setUrlInputMode("vercel")} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-secondary">
                            <TriangleIcon className="h-4 w-4 text-muted-foreground" />
                            Import from Vercel
                          </button>
                          <button type="button" onClick={() => setUrlInputMode("image")} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-secondary">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            Image URL
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 p-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {urlInputMode === "github" ? "GitHub repository" : urlInputMode === "vercel" ? "Vercel project" : "Image URL"}
                          </p>
                          <input
                            type="text"
                            autoFocus
                            value={urlInputValue}
                            onChange={(e) => setUrlInputValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleUrlImport();
                              if (e.key === "Escape") { setUrlInputMode(null); setUrlInputValue(""); }
                            }}
                            placeholder={urlInputMode === "github" ? "github.com/user/repo" : urlInputMode === "vercel" ? "vercel.com/project" : "https://..."}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/30"
                          />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => void handleUrlImport()} disabled={urlInputLoading || !urlInputValue.trim()} className="flex-1 rounded-lg bg-[#0056FD] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0047e0] disabled:opacity-40">
                              {urlInputLoading ? "Importing…" : "Import"}
                            </button>
                            <button type="button" onClick={() => { setUrlInputMode(null); setUrlInputValue(""); }} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!input.trim() && !attachedFile}
                  aria-label="Start building"
                  className="group flex h-8 w-8 items-center justify-center rounded-full bg-[#0056FD] text-white transition-colors hover:bg-[#0047e0] disabled:opacity-40"
                >
                  <ArrowUp className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5" />
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
