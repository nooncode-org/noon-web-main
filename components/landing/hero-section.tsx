"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowDown,
  ArrowRight,
  Mic,
  Paperclip,
  Sparkles,
  X,
  Upload,
  Github,
  FileText,
  Globe,
  TriangleIcon,
  MessageSquare,
} from "lucide-react";
import { getMaxwellStudioHubHref, getStartWithMaxwellHref, siteRoutes } from "@/lib/site-config";
import { HeroTemplatesPanel } from "./hero-templates-panel";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";

type AttachedFile = {
  name: string;
  mimeType: string;
  dataUrl: string;
  textContent?: string;
};

type Suggestion = { label: string; prompt: string };

export function HeroSection() {
  const router = useRouter();
  const params = useParams();
  const locale = (typeof params?.locale === "string" ? params.locale : null) ?? "en";
  const t = useTranslations("hero");
  const suggestions = t.raw("suggestions") as Suggestion[];

  const [inputValue, setInputValue] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState(0);
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [urlInputMode, setUrlInputMode] = useState<"github" | "vercel" | "image" | null>(null);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [urlInputLoading, setUrlInputLoading] = useState(false);
  const [showMyChatsLink, setShowMyChatsLink] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const sessionRes = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
          signal: ac.signal,
        });
        if (!sessionRes.ok) {
          setShowMyChatsLink(false);
          return;
        }

        const session = (await sessionRes.json()) as { user?: unknown };
        if (!session.user) {
          setShowMyChatsLink(false);
          return;
        }

        const res = await fetch("/api/maxwell/studio/sessions", {
          cache: "no-store",
          credentials: "same-origin",
          signal: ac.signal,
        });
        if (!res.ok) {
          setShowMyChatsLink(false);
          return;
        }
        const data = (await res.json()) as { sessions?: unknown[] };
        setShowMyChatsLink(Array.isArray(data.sessions) && data.sessions.length > 0);
      } catch {
        if (!ac.signal.aborted) setShowMyChatsLink(false);
      }
    })();
    return () => ac.abort();
  }, []);

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

  function startWithMaxwell() {
    const prompt = inputValue.trim();
    if (!prompt && !attachedFile) return;

    if (attachedFile) {
      try {
        sessionStorage.setItem("maxwell_attached_file", JSON.stringify(attachedFile));
      } catch {
        // sessionStorage full or unavailable
      }
    }
    router.push(getStartWithMaxwellHref(prompt || (attachedFile ? `I've attached a file: ${attachedFile.name}` : "")));
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSuggestion((prev) => (prev + 1) % suggestions.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [suggestions.length]);

  const handleSuggestionClick = (prompt: string) => {
    setInputValue(prompt);
  };


  const urlInputLabel =
    urlInputMode === "github"
      ? t("attachMenu.githubLabel")
      : urlInputMode === "vercel"
      ? t("attachMenu.vercelLabel")
      : t("attachMenu.imageLabel");

  return (
    <section id="hero" className="relative h-full flex flex-col justify-center pt-8 lg:pt-10">
      <div className="relative z-10 w-full max-w-[750px] mx-auto px-5 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-full">
            {/* Eyebrow */}
            <div className="mb-4 lg:mb-4 flex justify-center">
              <span className="liquid-glass-pill inline-flex items-center gap-1.5 text-[9px] lg:text-[10px] font-mono text-muted-foreground px-2 lg:px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {t("eyebrow")}
              </span>
            </div>

            {/* Main headline — Instrument Sans (the Figma typeface), matching
               the 4 ported pages instead of the site's default serif display. */}
            <div className="mb-4 lg:mb-5">
              <h1
                className="text-[1.35rem] sm:text-[1.6rem] lg:text-[clamp(1.6rem,2.5vw,2.15rem)] leading-[1.1] tracking-tight text-center"
                style={{ fontFamily: "var(--font-instrument)" }}
              >
                {t("headline")}
              </h1>
            </div>

            {/* Chat Input */}
            <div className="w-full">
              <div className="relative pb-[28px]">
                {/* Blue badge — behind card, aligned with card width */}
                <div
                  className={`absolute inset-x-0 bottom-0 h-[34px] ${
                    showTemplates ? "rounded-b-none" : "rounded-b-[9px]"
                  } flex items-end justify-center px-3.5 pb-1 text-[13px] font-medium text-white`}
                  style={{ background: "#1200C5" }}
                >
                  <span className="flex items-center gap-1.5">
                    {t("howItWorks")}
                    {/* Antes este link navegaba directo a /templates. Ahora actúa
                       como toggle que despliega el carrusel HeroTemplatesPanel
                       debajo del chat. Se preserva el <Link> original comentado
                       como safety net por si se quiere revertir a navegación:
                    <Link
                      href={`/${locale}${siteRoutes.templates}`}
                      className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                      {t("howItWorksLink")}
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Link>
                    */}
                    <button
                      type="button"
                      onClick={() => setShowTemplates((v) => !v)}
                      aria-expanded={showTemplates}
                      aria-controls="hero-templates-panel"
                      className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                      {t("howItWorksLink")}
                      <ArrowDown
                        className={`h-3.5 w-3.5 transition-transform duration-300 ${
                          showTemplates ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </span>
                </div>

                {/* Dark card — on top, full rounded corners */}
                <div className="relative z-10 bg-[#f9f9f9] dark:bg-[#131313] rounded-[9px] p-1.5 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
                  <div className="relative min-w-0 overflow-hidden">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          startWithMaxwell();
                        }
                      }}
                      placeholder={isInputFocused ? t("placeholder") : ""}
                      rows={3}
                      className="min-h-[44px] lg:min-h-[50px] w-full resize-none bg-transparent px-3 lg:px-3.5 py-1.5 text-[16px] leading-relaxed lg:text-[14px] outline-none placeholder:text-muted-foreground/60 text-left"
                      aria-label={t("placeholder")}
                    />
                    {!inputValue && !isInputFocused && (
                      // Sugerencia rotativa: matchea exactamente el font-size
                      // y padding del textarea para que no haya salto visual
                      // entre los estados default / focus / writing.
                      <div className="absolute left-0 right-0 top-0 px-3 lg:px-3.5 py-1.5 pointer-events-none overflow-hidden">
                        <span
                          key={currentSuggestion}
                          className="block w-full truncate whitespace-nowrap text-[16px] leading-relaxed lg:text-[14px] text-muted-foreground/45 animate-fade-in text-left"
                        >
                          {suggestions[currentSuggestion]?.prompt}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Attached file badge */}
                  {attachedFile && (
                    <div className="px-3 pb-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-foreground max-w-full">
                        <span className="truncate">{attachedFile.name}</span>
                        <button type="button" onClick={() => setAttachedFile(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    </div>
                  )}

                  <div className="mt-1.5 flex items-center justify-between gap-2 pt-2 px-1 pb-1">
                    {/* Left: tools */}

                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 gap-y-1.5">
                      <button
                        type="button"
                        aria-label="Voice input"
                        title="Voice input is not available yet."
                        disabled
                        className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full bg-secondary/45 text-muted-foreground/60"
                      >
                        <Mic className="h-3.5 w-3.5" />
                      </button>

                      <input ref={fileInputRef} type="file" accept="image/*,.txt,.md,.csv,.json,.doc,.docx" className="hidden" onChange={handleFileChange} />
                      <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />

                      {/* Attach menu */}
                      <div className="relative" ref={attachMenuRef}>
                        <button
                          type="button"
                          aria-label="Attach"
                          onClick={() => { setAttachMenuOpen((v) => !v); setUrlInputMode(null); setUrlInputValue(""); }}
                          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${attachMenuOpen ? "bg-secondary text-foreground" : "bg-secondary/45 text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </button>

                        {attachMenuOpen && (
                          <div className="liquid-glass-card absolute bottom-10 left-0 z-50 w-52 rounded-[10px] overflow-hidden">
                            {!urlInputMode ? (
                              <div className="py-1">
                                <button type="button" onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
                                  <Upload className="h-4 w-4 text-muted-foreground" />
                                  {t("attachMenu.uploadFile")}
                                </button>
                                <button type="button" onClick={() => { pdfInputRef.current?.click(); setAttachMenuOpen(false); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  {t("attachMenu.uploadPdf")}
                                </button>
                                <div className="my-1 h-px bg-border" />
                                <button type="button" onClick={() => setUrlInputMode("github")} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
                                  <Github className="h-4 w-4 text-muted-foreground" />
                                  {t("attachMenu.github")}
                                </button>
                                <button type="button" onClick={() => setUrlInputMode("vercel")} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
                                  <TriangleIcon className="h-4 w-4 text-muted-foreground" />
                                  {t("attachMenu.vercel")}
                                </button>
                                <button type="button" onClick={() => setUrlInputMode("image")} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
                                  <Globe className="h-4 w-4 text-muted-foreground" />
                                  {t("attachMenu.imageUrl")}
                                </button>
                              </div>
                            ) : (
                              <div className="p-3 space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">{urlInputLabel}</p>
                                <input
                                  type="text"
                                  autoFocus
                                  value={urlInputValue}
                                  onChange={(e) => setUrlInputValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") void handleUrlImport(); if (e.key === "Escape") { setUrlInputMode(null); setUrlInputValue(""); } }}
                                  placeholder={urlInputMode === "github" ? "github.com/user/repo" : urlInputMode === "vercel" ? "vercel.com/project" : "https://..."}
                                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/30"
                                />
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => void handleUrlImport()} disabled={urlInputLoading || !urlInputValue.trim()} className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors">
                                    {urlInputLoading ? t("importing") : t("import")}
                                  </button>
                                  <button type="button" onClick={() => { setUrlInputMode(null); setUrlInputValue(""); }} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary transition-colors">
                                    {t("cancel")}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/${locale}${siteRoutes.maxwell}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-secondary/45 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span className="hidden sm:inline">Maxwell</span>
                      </Link>
                      {showMyChatsLink ? (
                        <Link
                          href={`/${locale}${getMaxwellStudioHubHref()}`}
                          aria-label={t("myConversationsHint")}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/50 bg-secondary/55 px-2.5 py-1.5 text-xs font-medium text-foreground/90 transition-colors hover:bg-secondary hover:text-foreground"
                          title={t("myConversationsHint")}
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{t("myConversations")}</span>
                        </Link>
                      ) : null}
                    </div>

                    {/* Right: send button */}
                    <Button
                      type="button"
                      size="lg"
                      aria-label="Start with Maxwell"
                      onClick={startWithMaxwell}
                      disabled={!inputValue.trim() && !attachedFile}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 w-8 self-center p-0 rounded-[10px] group shrink-0 disabled:opacity-40"
                    >
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </div>
                </div>{/* end dark card */}
              </div>

              {/* Collapsible templates carousel — toggled by the badge link */}
              <HeroTemplatesPanel open={showTemplates} locale={locale} />

              {/* Prompt Suggestions */}
              <div className="mt-3 lg:mt-4">
                <p className="mb-2.5 text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground/55 text-center">
                  {t("notSure")}
                </p>
                {showAllPrompts ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {suggestions.map((s, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(s.prompt)}
                        className="liquid-glass-pill shrink-0 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground transition-all duration-300 hover:text-foreground"
                      >
                        {s.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowAllPrompts(false)}
                      aria-label="Collapse prompts"
                      className="liquid-glass-pill shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground text-base leading-none"
                    >
                      −
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {suggestions.slice(0, 3).map((s, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(s.prompt)}
                        className="liquid-glass-pill shrink-0 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground transition-all duration-300 hover:text-foreground"
                      >
                        {s.label}
                      </button>
                    ))}
                    {suggestions.slice(3, 5).map((s, index) => (
                      <button
                        key={index + 3}
                        onClick={() => handleSuggestionClick(s.prompt)}
                        className="liquid-glass-pill hidden sm:inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground transition-all duration-300 hover:text-foreground"
                      >
                        {s.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowAllPrompts(true)}
                      aria-label="Show all prompts"
                      className="liquid-glass-pill shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground text-base leading-none"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .prompt-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .prompt-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
