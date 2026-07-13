"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { ArrowUp, Plus } from "lucide-react";
import { NoonMark } from "@/components/brand/noon-logo";

// ── Shared constants ──────────────────────────────────────────────────────────
const BRIEF = "An inventory tool for our 3 warehouses.";

// Phase timing (ms)
const T_IDLE       = 1200;
const T_CHAR       = 55;
const T_SENT       = 500;
const T_PROCESSING = 1500;
const T_GENERATING = 5200;
const T_DONE       = 600;

// ── GenerateViz primitives ────────────────────────────────────────────────────
const GEN_CYCLE = 5;
const GEN_START = 0.1;
const GEN_STEP  = 0.28;
const GEN_SNAP  = 0.5;
const GEN_BUILD_DONE = (GEN_START + 12 * GEN_STEP + GEN_SNAP) / GEN_CYCLE;

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
    <div className="relative h-[380px] w-full overflow-hidden rounded-[10px] border border-foreground/10 bg-background/70">
      <div className="absolute inset-0 p-5">
        <BuildPiece order={0} active={active} className="mb-4 flex items-center gap-2">
          <div className="h-3 w-10 rounded-full bg-foreground/25" />
          <div className="ml-auto h-2 w-6 rounded-full bg-foreground/12" />
          <div className="h-2 w-6 rounded-full bg-foreground/12" />
          <div className="h-2 w-6 rounded-full bg-foreground/12" />
        </BuildPiece>
        <div className="mb-4 flex items-start gap-4">
          <div className="flex-1 space-y-2.5 pt-0.5">
            <BuildPiece order={1} active={active} className="h-4 w-3/4 rounded-full bg-foreground/30" />
            <BuildPiece order={2} active={active} className="h-2 w-1/2 rounded-full bg-foreground/12" />
            <BuildPiece order={3} active={active} className="mt-2 h-3.5 w-16 rounded-full bg-foreground/15" />
          </div>
          <BuildPiece order={4} active={active} className="h-20 w-24 rounded-md bg-foreground/[0.07]" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0,1,2].map((i) => (
            <BuildPiece key={i} order={5+i} active={active} className="space-y-2.5">
              <div className="h-12 rounded bg-foreground/[0.06]" />
              <div className="h-2 w-3/4 rounded-full bg-foreground/15" />
            </BuildPiece>
          ))}
        </div>
        <BuildPiece order={8} active={active} className="mt-3 space-y-2 rounded bg-foreground/[0.03] p-2.5">
          <div className="h-2 w-full rounded-full bg-foreground/[0.08]" />
          <div className="h-2 w-4/5 rounded-full bg-foreground/[0.08]" />
        </BuildPiece>
        <BuildPiece order={9} active={active} className="mt-3 flex items-center gap-2">
          <div className="h-3 w-12 rounded-[2px] bg-foreground/12" />
          <div className="ml-auto space-y-1.5">
            <div className="h-2 w-12 rounded-full bg-foreground/[0.08]" />
            <div className="h-1.5 w-8 rounded-full bg-foreground/[0.08]" />
          </div>
        </BuildPiece>
        <BuildPiece order={10} active={active} className="mt-3 h-2 w-12 rounded-full bg-green-500/70" />
        <BuildPiece order={11} active={active} className="mt-4 grid grid-cols-3 gap-3">
          {[0,1,2].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 w-10 rounded-full bg-foreground/25" />
              <div className="h-2 w-14 rounded-full bg-foreground/10" />
            </div>
          ))}
        </BuildPiece>
        <BuildPiece order={12} active={active} className="mt-4 flex items-center gap-3 rounded bg-foreground/[0.04] p-3">
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-3/4 rounded-full bg-foreground/20" />
            <div className="h-2 w-1/2 rounded-full bg-foreground/10" />
          </div>
          <div className="h-7 w-16 shrink-0 rounded-full bg-foreground/15" />
        </BuildPiece>
      </div>
    </div>
  );
}

// ── Phase type ────────────────────────────────────────────────────────────────
type Phase = "idle" | "typing" | "sent" | "processing" | "generating" | "done";

// ── InputPanel ────────────────────────────────────────────────────────────────
function InputPanel({ phase, typed }: { phase: Phase; typed: number }) {
  const text = BRIEF.slice(0, typed);
  const isReady = typed >= BRIEF.length;

  return (
    <div className="relative h-[380px] w-full overflow-hidden rounded-[10px] border border-foreground/10 bg-background/70 flex flex-col">
      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        {/* Input card */}
        <div className="w-full rounded-[9px] border border-foreground/[0.08] bg-foreground/[0.03] p-1.5">
          <div className="min-h-[80px] px-3 py-2 text-[13px] leading-relaxed">
            {text ? (
              <>
                <span className="text-foreground/82">{text}</span>
                {phase === "typing" && (
                  <span className="inline-block h-[13px] w-px bg-foreground/55 ml-0.5 align-middle"
                    style={{ animation: "cdsSk 0.9s ease-in-out infinite" }} />
                )}
              </>
            ) : (
              <span className="text-foreground/28">Describe what you need built…</span>
            )}
          </div>
          <div className="flex items-center justify-between px-1 pb-1 pt-1.5">
            <div className="h-7 w-7 flex items-center justify-center text-foreground/25">
              <Plus className="h-3.5 w-3.5" />
            </div>
            <motion.div
              className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center"
              animate={{ backgroundColor: isReady ? "#0056FD" : "rgba(128,128,128,0.12)" }}
              transition={{ duration: 0.22 }}
            >
              <ArrowUp className="w-3 h-3"
                style={{ color: isReady ? "#fff" : "rgba(128,128,128,0.4)" }} />
            </motion.div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── ProcessingPanel ───────────────────────────────────────────────────────────
function ProcessingPanel() {
  return (
    <div className="relative h-[380px] w-full overflow-hidden rounded-[10px] border border-foreground/10 bg-background/70 flex items-center justify-center">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-1 w-1 rounded-full bg-foreground/55"
            animate={{ opacity: [0.2, 0.9, 0.2], scale: [0.8, 1, 0.8] }}
            transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity, delay: i * 0.22 }}
          />
        ))}
      </div>
    </div>
  );
}

// ── CustomDevFlow — unified write → send → process → generate experience ──────
export function CustomDevFlow() {
  const [phase, setPhase]     = useState<Phase>("idle");
  const [typed, setTyped]     = useState(0);
  const [genActive, setGenActive] = useState(false);

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

        setPhase("sent");
        await delay(T_SENT);
        if (cancelled) break;

        setPhase("processing"); setTyped(0);
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

  const isChatPhase = phase === "idle" || phase === "typing" || phase === "sent";
  const isProcessing = phase === "processing";
  const isGenPhase   = phase === "generating" || phase === "done";

  return (
    <MotionConfig reducedMotion="never">
      <div style={{ flex: 1, minWidth: 0, maxWidth: 560, height: 420, overflow: "hidden", position: "relative" }}>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48"
          style={{ background: "linear-gradient(to bottom, transparent, var(--background))", zIndex: 50 }} />
        <div style={{ marginTop: 84 }}>
          {/* initial={false} = sin animacion de entrada SOLO en el primer mount
              (reemplaza el ref firstRender leido en render, que rompia lint) */}
          <AnimatePresence mode="wait" initial={false}>
            {isChatPhase && (
              <motion.div key="chat"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <InputPanel phase={phase} typed={typed} />
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
