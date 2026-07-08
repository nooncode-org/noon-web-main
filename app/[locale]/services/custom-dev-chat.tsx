"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, MotionConfig } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { NoonMark } from "@/components/brand/noon-logo";
import { EASE } from "@/lib/motion";

const PROMPT = "What do you want to build?";
const BRIEF = "An inventory tool for our 3 warehouses.";
const REPLY =
  "Got it — a real-time inventory dashboard synced across all three, with low-stock alerts and role-based access. Scoping it now…";

// ── GenerateViz (copied from upgrade-steps.tsx) ───────────────────────────
// Animates a site assembling itself piece by piece, then clears and loops.
const GEN_CYCLE = 8;
const GEN_START = 0.15;
const GEN_STEP  = 0.5;
const GEN_SNAP  = 0.7;

function BuildPiece({
  order, active, slide = false, className, children,
}: {
  order: number; active: boolean; slide?: boolean; className?: string; children?: ReactNode;
}) {
  const appearStart = GEN_START + order * GEN_STEP;
  const appearEnd   = appearStart + GEN_SNAP;
  const times       = [0, appearStart / GEN_CYCLE, appearEnd / GEN_CYCLE, 0.86, 0.96, 1];
  const shown     = slide ? { opacity: 1, x: 0 } : { opacity: 1, y: 0, scale: 1 };
  const keyframes = slide
    ? { opacity: [0,0,1,1,0,0], x: [-8,-8,0,0,0,-8] }
    : { opacity: [0,0,1,1,0,0], y: [8,8,0,0,0,8], scale: [0.94,0.94,1,1,1,0.94] };
  return (
    <motion.div
      className={className}
      initial={false}
      animate={active ? keyframes : shown}
      transition={active
        ? { duration: GEN_CYCLE, times, repeat: Infinity, ease: "easeOut", repeatDelay: 0.4 }
        : { duration: 0.4, ease: "easeOut" }}
    >{children}</motion.div>
  );
}

const GEN_BUILD_DONE = (GEN_START + 12 * GEN_STEP + GEN_SNAP) / GEN_CYCLE;

function GenerateViz({ active }: { active: boolean }) {
  return (
    <div className="relative h-72 w-full overflow-hidden rounded-[10px] border border-foreground/10 bg-background/70">
      {/* generation loading bar */}
      <div className="absolute inset-x-0 top-0 z-30 h-0.5 bg-foreground/10">
        <motion.div
          className="h-full origin-left bg-foreground/55"
          initial={false}
          animate={active ? { scaleX: [0,1,1,0,0] } : { scaleX: 1 }}
          transition={active
            ? { duration: GEN_CYCLE, times: [0, GEN_BUILD_DONE, 0.86, 0.96, 1], repeat: Infinity, ease: "linear", repeatDelay: 0.4 }
            : { duration: 0.4, ease: "linear" }}
        />
      </div>

      <div className="absolute inset-0 p-2.5">
        {/* nav */}
        <BuildPiece order={0} active={active} className="mb-2.5 flex items-center gap-2">
          <div className="h-2 w-7 rounded-full bg-foreground/25" />
          <div className="ml-auto h-1 w-4 rounded-full bg-foreground/12" />
          <div className="h-1 w-4 rounded-full bg-foreground/12" />
          <div className="h-1 w-4 rounded-full bg-foreground/12" />
        </BuildPiece>
        {/* hero text + media */}
        <div className="mb-2.5 flex items-start gap-2.5">
          <div className="flex-1 space-y-1.5 pt-0.5">
            <BuildPiece order={1} active={active} slide className="h-2 w-3/4 rounded-full bg-foreground/30" />
            <BuildPiece order={2} active={active} slide className="h-1 w-1/2 rounded-full bg-foreground/12" />
            <BuildPiece order={3} active={active} slide className="mt-1 h-2.5 w-10 rounded-full bg-foreground/15" />
          </div>
          <BuildPiece order={4} active={active} className="h-12 w-16 rounded-lg bg-foreground/[0.07]" />
        </div>
        {/* product cards */}
        <div className="grid grid-cols-3 gap-2">
          {[0,1,2].map((i) => (
            <BuildPiece key={i} order={5+i} active={active} className="space-y-1.5">
              <div className="h-6 rounded-md bg-foreground/[0.06]" />
              <div className="h-1 w-3/4 rounded-full bg-foreground/15" />
            </BuildPiece>
          ))}
        </div>
        {/* testimonial */}
        <BuildPiece order={8} active={active} className="mt-1.5 space-y-1 rounded-md bg-foreground/[0.03] p-1.5">
          <div className="h-1 w-full rounded-full bg-foreground/[0.08]" />
          <div className="h-1 w-4/5 rounded-full bg-foreground/[0.08]" />
        </BuildPiece>
        {/* footer */}
        <BuildPiece order={9} active={active} className="mt-1.5 flex items-start gap-2">
          <div className="h-2 w-8 rounded-[2px] bg-foreground/12" />
          <div className="ml-auto space-y-1">
            <div className="h-1 w-8 rounded-full bg-foreground/[0.08]" />
            <div className="h-1 w-6 rounded-full bg-foreground/[0.08]" />
          </div>
        </BuildPiece>
        {/* accent */}
        <BuildPiece order={10} active={active} className="mt-1.5 h-1 w-9 rounded-full bg-green-500/70" />
        {/* stats row */}
        <BuildPiece order={11} active={active} className="mt-2.5 grid grid-cols-3 gap-2">
          {[0,1,2].map((i) => (
            <div key={i} className="space-y-0.5">
              <div className="h-2.5 w-7 rounded-full bg-foreground/25" />
              <div className="h-1 w-10 rounded-full bg-foreground/10" />
            </div>
          ))}
        </BuildPiece>
        {/* CTA block */}
        <BuildPiece order={12} active={active} className="mt-2 flex items-center gap-2 rounded-md bg-foreground/[0.04] p-2">
          <div className="flex-1 space-y-1">
            <div className="h-1.5 w-3/4 rounded-full bg-foreground/20" />
            <div className="h-1 w-1/2 rounded-full bg-foreground/10" />
          </div>
          <div className="h-5 w-12 shrink-0 rounded-full bg-foreground/15" />
        </BuildPiece>
      </div>
    </div>
  );
}

// ── ChatViz ────────────────────────────────────────────────────────────────
// Wireframe chat: cursor → typing grows → user bubble → dots → bot reply.
function ChatViz() {
  type Phase = "idle" | "typing" | "sent" | "thinking" | "reply";
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let alive = true;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    (async function loop() {
      while (alive) {
        setPhase("idle"); setPct(0);
        await sleep(900);
        setPhase("typing");
        for (let i = 0; i <= 100; i += 5) {
          if (!alive) return;
          setPct(i);
          await sleep(38 + Math.random() * 28);
        }
        await sleep(280);
        if (!alive) return;
        setPhase("sent"); setPct(0);
        await sleep(560);
        if (!alive) return;
        setPhase("thinking");
        await sleep(1300);
        if (!alive) return;
        setPhase("reply");
        await sleep(3400);
      }
    })();
    return () => { alive = false; };
  }, []);

  const after = (...ps: Phase[]) => ps.includes(phase);

  return (
    <div className="relative h-72 w-full overflow-hidden rounded-[10px] border border-foreground/10 bg-background/70">
      {/* header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-foreground/10 bg-foreground/[0.03] px-3 py-2">
        <div className="h-4 w-4 shrink-0 rounded-[3px] bg-foreground/20" />
        <div className="h-2 w-14 rounded-full bg-foreground/20" />
        <span className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500/60" />
          <span className="h-1 w-8 rounded-full bg-foreground/12 inline-block" />
        </span>
      </div>

      {/* messages */}
      <div className="flex flex-col gap-2.5 p-3 pb-14">
        {/* bot message — static context */}
        <div className="flex items-end gap-1.5">
          <div className="h-4 w-4 shrink-0 rounded-[3px] bg-foreground/15" />
          <div className="max-w-[72%] space-y-1 rounded-xl rounded-bl-sm bg-foreground/[0.07] px-2.5 py-2">
            <div className="h-1 w-24 rounded-full bg-foreground/20" />
            <div className="h-1 w-20 rounded-full bg-foreground/12" />
          </div>
        </div>

        {/* user bubble */}
        {after("sent","thinking","reply") && (
          <div className="flex justify-end cds-in">
            <div className="max-w-[72%] space-y-1 rounded-xl rounded-br-sm bg-foreground/[0.18] px-2.5 py-2">
              <div className="h-1 w-28 rounded-full bg-foreground/30" />
              <div className="h-1 w-20 rounded-full bg-foreground/22" />
            </div>
          </div>
        )}

        {/* typing dots */}
        {phase === "thinking" && (
          <div className="flex items-center gap-1.5 cds-in">
            <div className="h-4 w-4 shrink-0 rounded-[3px] bg-foreground/15" />
            <div className="flex gap-1 rounded-xl rounded-bl-sm bg-foreground/[0.07] px-3 py-2.5">
              {[0,1,2].map((i) => (
                <span key={i} className="block h-1.5 w-1.5 rounded-full bg-foreground/40"
                  style={{ animation: `cdsSk 1s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {/* bot reply */}
        {phase === "reply" && (
          <div className="flex items-end gap-1.5 cds-in">
            <div className="h-4 w-4 shrink-0 rounded-[3px] bg-foreground/15" />
            <div className="max-w-[72%] space-y-1 rounded-xl rounded-bl-sm bg-foreground/[0.07] px-2.5 py-2">
              <div className="h-1 w-32 rounded-full bg-foreground/20" />
              <div className="h-1 w-28 rounded-full bg-foreground/12" />
              <div className="h-1 w-20 rounded-full bg-foreground/12" />
            </div>
          </div>
        )}
      </div>

      {/* input */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 border-t border-foreground/10 bg-foreground/[0.02] px-3 py-2">
        <div className="flex h-7 flex-1 items-center gap-1 overflow-hidden rounded-full bg-foreground/[0.06] px-3">
          {phase === "typing" && (
            <div className="h-1 rounded-full bg-foreground/25 transition-all duration-75"
              style={{ width: `${pct * 0.6}%` }} />
          )}
          {after("idle","typing") && (
            <div className="h-3.5 w-px shrink-0 bg-foreground/40"
              style={{ animation: "cdsSk 0.9s ease-in-out infinite" }} />
          )}
          {!after("typing") && phase !== "idle" && (
            <div className="h-1 w-14 rounded-full bg-foreground/10" />
          )}
        </div>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/20">
          <div className="h-2.5 w-2.5 rounded-sm bg-foreground/35" />
        </div>
      </div>
    </div>
  );
}

export function CustomDevChatViz() {
  return (
    <div style={{ flex: 1, minWidth: 0, maxWidth: 380 }}>
      <ChatViz />
    </div>
  );
}

// Wraps GenerateViz for the Custom Dev featured block panel.
// Mounts with active=false so framer-motion establishes the resting state,
// then flips to true on the next frame so the loop animation fires correctly.
export function CustomDevScreens() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <MotionConfig reducedMotion="never">
      <div style={{ flex: 1, minWidth: 0, maxWidth: 380 }}>
        <GenerateViz active={active} />
      </div>
    </MotionConfig>
  );
}

// Looping chat mockup for the Custom Development card — a live Maxwell scoping
// conversation. JS-driven (not CSS keyframes) so it animates even under a
// prefers-reduced-motion reset; the motion is the whole point. Scene machine:
// type the brief into the input → send it as a bubble → Maxwell "thinks" →
// streams a scoped reply → hold → loop.
export function CustomDevChat() {
  const [typed, setTyped] = useState("");
  const [sent, setSent] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [reply, setReply] = useState("");
  const [cursor, setCursor] = useState(true);

  // blinking caret (JS so the reduced-motion CSS reset can't freeze it)
  useEffect(() => {
    const id = setInterval(() => setCursor((c) => !c), 520);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const type = async (setter: (s: string) => void, text: string, base: number) => {
      for (let i = 1; i <= text.length; i++) {
        if (!alive) return;
        setter(text.slice(0, i));
        await sleep(base + Math.random() * 45);
      }
    };
    (async function loop() {
      while (alive) {
        setTyped("");
        setSent(false);
        setThinking(false);
        setReply("");
        await sleep(1100);
        await type(setTyped, BRIEF, 42); // type the brief into the input
        await sleep(650);
        if (!alive) return;
        setSent(true); // "send" — becomes a user bubble
        setTyped("");
        await sleep(550);
        setThinking(true); // Maxwell thinking…
        await sleep(1150);
        if (!alive) return;
        setThinking(false);
        await type(setReply, REPLY, 18); // stream the scoped reply
        await sleep(3400); // hold, then loop
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="cdc" aria-hidden>
      <div className="cdc-head">
        <span className="cdc-avatar">
          <NoonMark />
        </span>
        <span className="cdc-name">Maxwell</span>
        <span className="cdc-status">
          <span className="cdc-status-dot" />
          online
        </span>
      </div>

      <div className="cdc-body">
        <div className="cdc-msg cdc-bot">{PROMPT}</div>
        {sent && <div className="cdc-msg cdc-user cdc-in">{BRIEF}</div>}
        {thinking && (
          <div className="cdc-msg cdc-bot cdc-dots cdc-in" aria-label="Maxwell is typing">
            <span />
            <span />
            <span />
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
        <span className="cdc-send">
          <ArrowUp size={14} strokeWidth={2.25} />
        </span>
      </div>
    </div>
  );
}
