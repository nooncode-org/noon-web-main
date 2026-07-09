"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { NoonMark } from "@/components/brand/noon-logo";

// ── Shared constants ──────────────────────────────────────────────────────────
const BRIEF = "An inventory tool for our 3 warehouses.";

// Phase timing (ms)
const T_IDLE       = 1200;
const T_CHAR       = 55;
const T_SENT       = 650;
const T_THINKING   = 1600;
const T_PROCESSING = 1500;
const T_GENERATING = 5200;
const T_DONE       = 600;

// ── GenerateViz primitives ────────────────────────────────────────────────────
const GEN_CYCLE = 5;
const GEN_START = 0.1;
const GEN_STEP  = 0.28;
const GEN_SNAP  = 0.5;
const GEN_BUILD_DONE = (GEN_START + 3 * GEN_STEP + GEN_SNAP) / GEN_CYCLE;

function BuildPiece({
  order, active, className, children,
}: {
  order: number; active: boolean; className?: string; children?: ReactNode;
}) {
  const appearStart = GEN_START + order * GEN_STEP;
  const appearEnd   = appearStart + GEN_SNAP;
  const times       = [0, appearStart / GEN_CYCLE, appearEnd / GEN_CYCLE, 1];
  return (
    <motion.div
      className={className}
      initial={false}
      animate={active ? { opacity: [0, 0, 1, 1] } : { opacity: 1 }}
      transition={active
        ? { duration: GEN_CYCLE, times, ease: "linear" }
        : { duration: 0.3 }}
    >{children}</motion.div>
  );
}

// ── GenerateViz ───────────────────────────────────────────────────────────────
function GenerateViz({ active }: { active: boolean }) {
  return (
    <div className="relative h-80 w-full overflow-hidden rounded-[10px] border border-foreground/10 bg-background/70">
      {/* progress bar */}
      <div className="absolute inset-x-0 top-0 z-30 h-0.5 bg-foreground/10">
        <motion.div
          className="h-full origin-left bg-foreground/55"
          initial={false}
          animate={active ? { scaleX: [0, 1, 1] } : { scaleX: 1 }}
          transition={active
            ? { duration: GEN_CYCLE, times: [0, GEN_BUILD_DONE, 1], ease: "linear" }
            : { duration: 0.4, ease: "linear" }}
        />
      </div>
      {/* bottom dissolve */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20"
        style={{ height: "58%", background: "linear-gradient(to bottom, transparent, var(--background))" }}
      />
      <div className="absolute inset-0 p-4 pt-5">
        {/* Nav */}
        <BuildPiece order={0} active={active} className="mb-4 flex items-center gap-2.5">
          <div className="h-3 w-3 shrink-0 rounded-full bg-foreground/25" />
          <div className="h-1.5 w-12 rounded-full bg-foreground/20" />
          <div className="ml-auto flex items-center gap-2">
            <div className="h-5 w-12 rounded bg-foreground/[0.07]" />
            <div className="h-5 w-12 rounded bg-foreground/[0.07]" />
            <div className="h-5 w-12 rounded bg-foreground/[0.07]" />
          </div>
        </BuildPiece>
        {/* Two cards */}
        <div className="grid grid-cols-2 gap-3">
          <BuildPiece order={1} active={active} className="h-32 rounded-lg bg-foreground/[0.06]" />
          <BuildPiece order={2} active={active} className="h-44 rounded-lg bg-foreground/[0.06]" />
        </div>
        {/* Bottom wide section with subtle divider */}
        <BuildPiece order={3} active={active} className="mt-3 flex h-16 w-full overflow-hidden rounded-lg bg-foreground/[0.04]">
          <div className="flex-1" />
          <div className="w-px bg-foreground/[0.06]" />
          <div className="flex-1" />
        </BuildPiece>
      </div>
    </div>
  );
}

// ── Phase type ────────────────────────────────────────────────────────────────
type Phase = "idle" | "typing" | "sent" | "thinking" | "processing" | "generating" | "done";

// ── ChatPanel ─────────────────────────────────────────────────────────────────
function ChatPanel({ phase, typed }: { phase: Phase; typed: number }) {
  const hasBubble  = phase === "sent" || phase === "thinking";
  const hasThinking = phase === "thinking";

  return (
    <div className="relative h-80 w-full overflow-hidden rounded-[10px] border border-foreground/10 bg-background/70 flex flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-foreground/[0.07] px-3 py-2.5">
        <div className="h-3 w-3 shrink-0 rounded-sm bg-foreground/15 flex items-center justify-center">
          <NoonMark size={5} />
        </div>
        <div className="h-1.5 w-20 rounded-full bg-foreground/20" />
        <div className="ml-auto flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
          <div className="h-1 w-10 rounded-full bg-foreground/12" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-2.5 px-3 py-3">
        {/* Bot opening message */}
        <div className="flex items-start gap-2">
          <div className="h-3 w-3 shrink-0 rounded-full bg-foreground/[0.08] border border-foreground/[0.08] flex items-center justify-center">
            <NoonMark size={5} />
          </div>
          <div className="space-y-1.5 pt-0.5">
            <div className="h-1.5 w-36 rounded-full bg-foreground/18" />
            <div className="h-1 w-24 rounded-full bg-foreground/10" />
          </div>
        </div>

        {/* User bubble */}
        <AnimatePresence>
          {hasBubble && (
            <motion.div
              key="user-bubble"
              className="flex justify-end"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="max-w-[72%] rounded-2xl rounded-br-sm bg-foreground/12 px-3 py-2">
                <div className="h-1.5 w-32 rounded-full bg-foreground/32 mb-1.5" />
                <div className="h-1 w-20 rounded-full bg-foreground/18" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thinking dots */}
        <AnimatePresence>
          {hasThinking && (
            <motion.div
              key="thinking"
              className="flex items-start gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="h-3 w-3 shrink-0 rounded-full bg-foreground/[0.08] border border-foreground/[0.08] flex items-center justify-center">
                <NoonMark size={5} />
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-foreground/[0.06] border border-foreground/[0.05] px-4 py-2">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="cds-sk block h-1.5 w-1.5 rounded-full"
                    style={{ animationDelay: `${i * 0.18}s` }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-foreground/[0.07] px-3 py-2.5 flex items-center gap-2">
        <div className="flex-1 h-7 rounded-full bg-foreground/[0.05] px-3 flex items-center gap-1.5 overflow-hidden">
          {(phase === "idle" || phase === "typing") && (
            <>
              <motion.div
                className="rounded-full bg-foreground/22"
                style={{ height: 6 }}
                animate={{ width: typed > 0 ? `${Math.round((typed / BRIEF.length) * 62)}%` : 0 }}
                transition={{ duration: 0.04, ease: "linear" }}
              />
              <div className="h-3.5 w-px shrink-0 bg-foreground/35"
                style={{ animation: "cdsSk 0.9s ease-in-out infinite" }} />
            </>
          )}
        </div>
        <motion.div
          className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center"
          animate={{ backgroundColor: typed > 0 ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.10)" }}
          transition={{ duration: 0.18 }}
        >
          <ArrowUp size={12} strokeWidth={2.5}
            style={{ opacity: typed > 0 ? 1 : 0.28, color: typed > 0 ? "#000" : "currentColor" }} />
        </motion.div>
      </div>
    </div>
  );
}

// ── ProcessingPanel ───────────────────────────────────────────────────────────
function ProcessingPanel() {
  return (
    <div className="relative h-80 w-full overflow-hidden rounded-[10px] border border-foreground/10 bg-background/70 flex flex-col items-center justify-center gap-5">
      <div className="w-[66%]">
        <div className="h-px bg-foreground/[0.08]" />
        <motion.div
          className="h-px origin-left bg-foreground/45 -mt-px"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 0.82 }}
          transition={{ duration: 1.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
      <p className="font-mono text-[11px] tracking-[0.15em] text-foreground/25 uppercase select-none">
        Scoping
      </p>
    </div>
  );
}

// ── CustomDevFlow — unified write → send → process → generate experience ──────
export function CustomDevFlow() {
  const [phase, setPhase]     = useState<Phase>("idle");
  const [typed, setTyped]     = useState(0);
  const [genActive, setGenActive] = useState(false);
  const firstRender = useRef(true);
  useEffect(() => { firstRender.current = false; }, []);

  useEffect(() => {
    let cancelled = false;
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    async function run() {
      while (!cancelled) {
        setPhase("idle"); setTyped(0); setGenActive(false);
        await delay(T_IDLE);
        if (cancelled) break;

        setPhase("typing");
        for (let i = 1; i <= BRIEF.length; i++) {
          if (cancelled) break;
          setTyped(i);
          await delay(T_CHAR + (Math.random() > 0.85 ? 80 : 0));
        }
        if (cancelled) break;

        setPhase("sent"); setTyped(0);
        await delay(T_SENT);
        if (cancelled) break;

        setPhase("thinking");
        await delay(T_THINKING);
        if (cancelled) break;

        setPhase("processing");
        await delay(T_PROCESSING);
        if (cancelled) break;

        setPhase("generating");
        requestAnimationFrame(() => { if (!cancelled) setGenActive(true); });
        await delay(T_GENERATING);
        if (cancelled) break;

        setPhase("done"); setGenActive(false);
        await delay(T_DONE);
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  const isChatPhase = phase === "idle" || phase === "typing" || phase === "sent" || phase === "thinking";
  const isProcessing = phase === "processing";
  const isGenPhase   = phase === "generating" || phase === "done";

  return (
    <MotionConfig reducedMotion="never">
      <div style={{ flex: 1, minWidth: 0, maxWidth: 460 }}>
        <AnimatePresence mode="wait">
          {isChatPhase && (
            <motion.div key="chat"
              initial={firstRender.current ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <ChatPanel phase={phase} typed={typed} />
            </motion.div>
          )}
          {isProcessing && (
            <motion.div key="processing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <ProcessingPanel />
            </motion.div>
          )}
          {isGenPhase && (
            <motion.div key="generating"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.38, ease: "easeOut" }}
            >
              <GenerateViz active={genActive} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

// ── CustomDevChat — original looping chat (saved, not rendered in the panel) ──
export function CustomDevChat() {
  const [typed, setTyped]     = useState("");
  const [sent, setSent]       = useState(false);
  const [thinking, setThinking] = useState(false);
  const [reply, setReply]     = useState("");
  const [cursor, setCursor]   = useState(true);
  const PROMPT = "What do you want to build?";
  const REPLY  = "Got it — a real-time inventory dashboard synced across all three, with low-stock alerts and role-based access. Scoping it now…";

  useEffect(() => {
    const id = setInterval(() => setCursor((c) => !c), 520);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const type  = async (setter: (s: string) => void, text: string, base: number) => {
      for (let i = 1; i <= text.length; i++) {
        if (!alive) return;
        setter(text.slice(0, i));
        await sleep(base + Math.random() * 45);
      }
    };
    (async function loop() {
      while (alive) {
        setTyped(""); setSent(false); setThinking(false); setReply("");
        await sleep(1100);
        await type(setTyped, BRIEF, 42);
        await sleep(650);
        if (!alive) return;
        setSent(true); setTyped("");
        await sleep(550);
        setThinking(true);
        await sleep(1150);
        if (!alive) return;
        setThinking(false);
        await type(setReply, REPLY, 18);
        await sleep(3400);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="cdc" aria-hidden>
      <div className="cdc-head">
        <span className="cdc-avatar"><NoonMark /></span>
        <span className="cdc-name">Maxwell</span>
        <span className="cdc-status">
          <span className="cdc-status-dot" />online
        </span>
      </div>
      <div className="cdc-body">
        <div className="cdc-msg cdc-bot">{PROMPT}</div>
        {sent && <div className="cdc-msg cdc-user cdc-in">{BRIEF}</div>}
        {thinking && (
          <div className="cdc-msg cdc-bot cdc-dots cdc-in" aria-label="Maxwell is typing">
            <span /><span /><span />
          </div>
        )}
        {reply && <div className="cdc-msg cdc-bot cdc-in">{reply}</div>}
      </div>
      <div className="cdc-input">
        <span className="cdc-field">
          <span className="cdc-typed">{typed}</span>
          <span className={`cdc-cursor ${cursor ? "on" : ""}`} />
          {!typed && <span className="cdc-ph">Describe what you want to build…</span>}
        </span>
        <span className="cdc-send"><ArrowUp size={14} strokeWidth={2.25} /></span>
      </div>
    </div>
  );
}
