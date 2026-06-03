"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LoaderCircle, Sparkles, X } from "lucide-react";
import { Highlight, type PrismTheme } from "prism-react-renderer";
import NumberFlow from "@number-flow/react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { getStartWithMaxwellHref } from "@/lib/site-config";

// ============================================================================
// Pipeline mockups — contextual in-card motion (2026-06-01).
// Theme-aware (tokens, not dark-only), single accent (#1200c5 = primary),
// neutral window dots, no 3rd-party model labels. Each shows a real Noon
// artifact and animates ONLY in a way that means something for that step:
//   - brief      → typewriter w/ blinking caret (someone describing a need)
//   - scope      → "thinking" gradient-shimmer + skeleton, then resolved rows
//   - build      → streamed review diff + the human-review check landing last
//   - product    → dashboard draws itself (bars grow, chart path draws)
//
// Props: `play` = section is in view (animate once); `animate` = motion allowed
// (false under reduced motion → final static state); `startDelay` = seconds to
// offset the start so the four cards animate in flow order, left→right.
// ============================================================================

const EASE = [0.32, 0.72, 0, 1] as const;

type MockupProps = { play?: boolean; animate?: boolean; startDelay?: number };

function Dots() {
  return (
    <div className="flex gap-1.5">
      <span className="h-2 w-2 rounded-full bg-foreground/15" />
      <span className="h-2 w-2 rounded-full bg-foreground/15" />
      <span className="h-2 w-2 rounded-full bg-foreground/15" />
    </div>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[8px] border border-foreground/10 bg-background/40">
      <div className="flex items-center gap-2 border-b border-foreground/10 px-2.5 py-1.5">
        <Dots />
        <span className="ml-1 truncate font-mono text-[9px] text-muted-foreground">{title}</span>
      </div>
      <div className="min-h-0 flex-1 p-2.5">{children}</div>
    </div>
  );
}

const fade = (play: boolean, delay = 0) => ({
  initial: { opacity: 0, y: 4 },
  animate: { opacity: play ? 1 : 0.4, y: 0 },
  transition: { delay, duration: 0.3, ease: EASE },
});

// Shared loading line: spinner + shimmering label (the "working" content state).
function Working({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <LoaderCircle className="h-3 w-3 animate-spin text-primary" />
      <span
        className="bg-clip-text font-mono text-[10px] text-transparent"
        style={{
          backgroundImage:
            "linear-gradient(90deg, var(--muted-foreground) 0%, var(--foreground) 50%, var(--muted-foreground) 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.1s linear infinite",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// Small hook: a content-state that flips to "done" after `seconds`, on view.
// Decoupled from reduced motion (it's an informational state change).
function useResolveOnPlay(play: boolean, seconds: number) {
  const [done, setDone] = useState(!play);
  useEffect(() => {
    if (!play) {
      setDone(true);
      return;
    }
    setDone(false);
    const t = setTimeout(() => setDone(true), seconds * 1000);
    return () => clearTimeout(t);
  }, [play, seconds]);
  return done;
}

// ── 1 — The need: a real scoping conversation with Maxwell ──────────────────
// Messages reveal one by one, with a "Maxwell is typing…" indicator before each
// of Maxwell's replies (auto-scrolls to the latest). The input stays REAL —
// type and submit to open Maxwell with the prompt preserved. Decoupled from
// reduced motion (informational); shows the full thread instantly when not playing.
type ChatTurn = { who: "user" | "maxwell"; text: string };

const CHAT: ChatTurn[] = [
  { who: "user", text: "We need a portal where clients track their orders in real time — status, history, alerts." },
  { who: "maxwell", text: "Got it. Should clients log in, or track via a link?" },
  { who: "user", text: "Login — each client sees only their own orders." },
  { who: "maxwell", text: "Clear. Scoping auth, live status, history, and email + SMS alerts. Payments stay in phase 2." },
];

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-muted-foreground"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

export function MockupBrief({ play = false, animate = true, startDelay = 0 }: MockupProps) {
  void animate;
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(play ? 0 : CHAT.length);
  const [typing, setTyping] = useState(false);
  const [value, setValue] = useState("");

  // Drive the conversation forward on view (with a typing pause before Maxwell).
  useEffect(() => {
    if (!play) {
      setShown(CHAT.length);
      setTyping(false);
      return;
    }
    setShown(0);
    setTyping(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = startDelay * 1000 + 200;
    CHAT.forEach((turn, i) => {
      if (turn.who === "maxwell") {
        timers.push(setTimeout(() => setTyping(true), t));
        t += 850;
        timers.push(
          setTimeout(() => {
            setTyping(false);
            setShown(i + 1);
          }, t)
        );
        t += 700;
      } else {
        timers.push(setTimeout(() => setShown(i + 1), t));
        t += 1000;
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [play, startDelay]);

  // Auto-scroll to the latest message / typing indicator.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, typing]);

  function submit() {
    const prompt = value.trim();
    if (!prompt) return;
    router.push(getStartWithMaxwellHref(prompt));
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[8px] border border-foreground/10 bg-background/40">
      {/* Chat header */}
      <div className="flex items-center gap-2 border-b border-foreground/10 px-2.5 py-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full text-primary" style={{ backgroundColor: "rgba(18,0,197,0.14)" }}>
          <Sparkles className="h-2.5 w-2.5" />
        </span>
        <span className="text-[10px] font-medium text-foreground">Maxwell</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[8px] text-muted-foreground">
          <span className="h-1 w-1 rounded-full bg-primary" /> scoping
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} tabIndex={0} aria-label="Example scoping conversation" className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2.5 py-2">
        {CHAT.slice(0, shown).map((turn, i) =>
          turn.who === "user" ? (
            <motion.div key={i} className="flex justify-end" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <p className="max-w-[88%] rounded-[8px] border border-primary/30 bg-primary/10 px-2 py-1 text-[9.5px] leading-snug text-foreground/90">
                {turn.text}
              </p>
            </motion.div>
          ) : (
            <motion.div key={i} className="flex justify-start" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <p className="max-w-[88%] rounded-[8px] border border-foreground/10 bg-secondary/50 px-2 py-1 text-[9.5px] leading-snug text-foreground/80">
                {turn.text}
              </p>
            </motion.div>
          )
        )}
        {typing && (
          <div className="flex justify-start">
            <span className="rounded-[8px] border border-foreground/10 bg-secondary/50 px-2 py-1.5">
              <TypingDots />
            </span>
          </div>
        )}
      </div>

      {/* Real input — type and submit to Maxwell */}
      <div className="flex items-center gap-1.5 border-t border-foreground/10 bg-background/60 px-2 py-1.5 transition-colors focus-within:border-primary/40">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Reply to Maxwell…"
          aria-label="Reply to Maxwell"
          className="min-w-0 flex-1 bg-transparent text-[10px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          aria-label="Send to Maxwell"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[8px] text-primary transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "rgba(18,0,197,0.12)" }}
        >
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── 2 — Scope with Maxwell ("thinking" → a real scope.md doc) ───────────────
const SCOPE_DOC: { h: string; type: "text" | "check" | "cross"; items: string[] }[] = [
  { h: "Goal", type: "text", items: ["Client order-tracking portal"] },
  {
    h: "In scope",
    type: "check",
    items: [
      "Email + password login",
      "Live order status (Supabase Realtime)",
      "Order history & search",
      "Email + SMS alerts on status change",
      "Admin view for the Noon team",
    ],
  },
  { h: "Out of scope", type: "cross", items: ["Payments & billing → phase 2", "Native mobile app"] },
  { h: "Stack", type: "text", items: ["Next.js · Supabase Realtime · Resend · Twilio"] },
  { h: "Engagement", type: "text", items: ["Custom Development · fixed scope"] },
  {
    h: "Milestones",
    type: "text",
    items: ["1 · Auth + order list", "2 · Live status + history", "3 · Alerts + admin view"],
  },
  {
    h: "Acceptance",
    type: "check",
    items: [
      "Each client sees only their own orders",
      "Status reflects updates in real time",
      "An alert fires on every status change",
    ],
  },
];

export function MockupScope({ play = false, animate = true, startDelay = 0 }: MockupProps) {
  // "Thinking" → resolved is an informational content state → runs on view
  // regardless of prefers-reduced-motion.
  void animate;
  const shouldThink = play;
  const [thinking, setThinking] = useState(shouldThink);

  useEffect(() => {
    if (!shouldThink) {
      setThinking(false);
      return;
    }
    setThinking(true);
    const begin = setTimeout(() => setThinking(true), startDelay * 1000);
    const done = setTimeout(() => setThinking(false), startDelay * 1000 + 850);
    return () => {
      clearTimeout(begin);
      clearTimeout(done);
    };
  }, [shouldThink, startDelay]);

  return (
    <Shell title="scope.md">
      {thinking ? (
        <div className="space-y-2">
          <span
            className="block w-[70%] bg-clip-text font-mono text-[9px] text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--muted-foreground) 0%, var(--foreground) 50%, var(--muted-foreground) 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.1s linear infinite",
            }}
          >
            Maxwell is scoping your request…
          </span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-1.5 w-10 animate-pulse rounded-full bg-foreground/10" />
              <div className="h-1.5 w-[80%] animate-pulse rounded-full bg-foreground/10" style={{ animationDelay: `${i * 120}ms` }} />
            </div>
          ))}
        </div>
      ) : (
        // Scrolls within the card when the doc is taller than the space.
        <div tabIndex={0} aria-label="Example scope document" className="h-full space-y-2.5 overflow-y-auto pr-1">
          {SCOPE_DOC.map((section, si) => (
            <motion.div
              key={section.h}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * si, duration: 0.3, ease: EASE }}
            >
              <p className="mb-1 font-mono text-[9px] text-muted-foreground/60">
                <span className="text-primary/60">## </span>
                <span className="font-medium uppercase tracking-[0.08em] text-muted-foreground/80">{section.h}</span>
              </p>
              <ul className="space-y-0.5">
                {section.items.map((it, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[10px] leading-snug">
                    {section.type === "check" ? (
                      <Check className="mt-[2px] h-2.5 w-2.5 shrink-0 text-primary" strokeWidth={3} />
                    ) : section.type === "cross" ? (
                      <X className="mt-[2px] h-2.5 w-2.5 shrink-0 text-muted-foreground/50" strokeWidth={3} />
                    ) : (
                      <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                    )}
                    <span className={section.type === "cross" ? "text-muted-foreground/70" : "text-foreground/85"}>{it}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ── 3 — Human review & build ───────────────────────────────────────────────
// A real code editor: line-number gutter, diff markers, and a status bar.
// Tokenization is done by prism-react-renderer (real TS grammar) but painted
// with Noon's own theme-aware syntax vars (--code-*) via a custom Prism theme —
// so it reads as genuine code yet stays on-brand in light + dark, instead of a
// generic VS Code palette. "Reviewing…" → the reviewed diff streams in row by row.
const NOON_PRISM_THEME: PrismTheme = {
  plain: { color: "var(--code-txt)", backgroundColor: "transparent" },
  styles: [
    { types: ["keyword", "builtin", "boolean", "imports", "exports"], style: { color: "var(--code-kw)" } },
    { types: ["function", "function-variable", "method"], style: { color: "var(--code-fn)" } },
    { types: ["class-name", "maybe-class-name"], style: { color: "var(--code-fn)" } },
    { types: ["string", "char", "url", "attr-value", "template-string"], style: { color: "var(--code-str)" } },
    { types: ["number", "constant", "property", "literal-property", "property-access"], style: { color: "var(--code-prop)" } },
    { types: ["punctuation", "operator"], style: { color: "var(--code-punc)" } },
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "var(--code-gutter)", fontStyle: "italic" } },
  ],
};

// A realistic orders.ts diff from the brief: fetch an order WITH its live status
// + event history, and fire an alert when the status changes. MARKERS runs
// parallel to the code lines and overlays the review diff (-/+); long enough to
// scroll. Tokenization is real (prism); the markers are ours.
const CODE = `import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

export async function getOrder(id: string) {
  return db.orders.find(id)
  return db.orders.find(id, {
    include: { status: true, events: true },
  })
}

export async function updateStatus(id, next) {
  const order = await getOrder(id)
  await notify(order.customerId, next)
  return db.orders.update(id, { status: next })
}`;

const MARKERS: (" " | "+" | "-")[] = [
  " ", "+", " ", " ", "-", "+", "+", "+", " ", " ", " ", " ", "+", " ", " ",
];

export function MockupBuild({ play = false, startDelay = 0 }: MockupProps) {
  // "Reviewing…" → the diff streams in + the status bar confirms review.
  const done = useResolveOnPlay(play, startDelay + 0.7);
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[8px] border border-foreground/10 bg-background/40 font-mono">
      {/* Editor chrome — same theme-aware treatment as the other cards */}
      <div className="flex items-center gap-2 border-b border-foreground/10 px-2.5 py-1.5">
        <Dots />
        <span className="ml-1 truncate text-[9px] text-foreground/80">orders.ts</span>
        <span className="ml-auto text-[8px] text-muted-foreground">TypeScript</span>
      </div>

      {/* Body */}
      <div tabIndex={0} aria-label="Example code review" className="min-h-0 flex-1 overflow-y-auto">
        {!done ? (
          <div className="px-2.5 py-2.5">
            <Working label="Reviewing changes…" />
          </div>
        ) : (
          <Highlight code={CODE} language="tsx" theme={NOON_PRISM_THEME}>
            {({ tokens, getTokenProps }) => (
              <div className="py-1 text-[9.5px] leading-[1.7]">
                {tokens.map((line, i) => {
                  const marker = MARKERS[i] ?? " ";
                  const rowBg =
                    marker === "+" ? "var(--code-add-bg)" : marker === "-" ? "var(--code-rem-bg)" : "transparent";
                  const markColor =
                    marker === "+"
                      ? "var(--code-add-mark)"
                      : marker === "-"
                        ? "var(--code-rem-mark)"
                        : "var(--code-gutter)";
                  return (
                    <motion.div
                      key={i}
                      className="flex items-center"
                      style={{ backgroundColor: rowBg }}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.12, duration: 0.28, ease: EASE }}
                    >
                      <span
                        className="w-5 shrink-0 select-none pr-1 text-right text-[8px]"
                        style={{ color: "var(--code-gutter)" }}
                      >
                        {i + 1}
                      </span>
                      <span className="w-2.5 shrink-0 select-none text-center" style={{ color: markColor }}>
                        {marker}
                      </span>
                      <span className="whitespace-pre">
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token })} />
                        ))}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Highlight>
        )}
      </div>

      {/* Status bar — review confirmation */}
      {done && (
        <motion.div
          className="flex items-center gap-1.5 border-t border-foreground/10 px-2.5 py-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.3 }}
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" style={{ color: "var(--code-ok)" }}>
            <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[8.5px] text-muted-foreground">reviewed by senior engineer · 3 suggestions applied</span>
        </motion.div>
      )}
    </div>
  );
}

// ── 4 — Working software you operate ────────────────────────────────────────
// The actual order-tracking portal from the brief, live: KPI summary + a real
// order list with statuses. Sample data is illustrative product UI (not a Noon
// performance claim). "Deploying…" → the dashboard populates row by row.
const ORDER_KPIS = [
  { label: "In transit", value: 24 },
  { label: "Delivered", value: 312 },
  { label: "Pending", value: 8 },
];
// Illustrative order volume over the last 12 days (product-demo data, not a Noon
// metric) — drives the dashboard's trend sparkline.
const ORDER_TREND = [18, 22, 19, 27, 24, 31, 28, 35, 30, 38, 34, 42].map((v, i) => ({ i, v }));
const ORDER_ROWS: { id: string; customer: string; eta: string; status: "transit" | "delivered" | "pending" }[] = [
  { id: "#1042", customer: "Acme Co.", eta: "Today", status: "transit" },
  { id: "#1041", customer: "Lumen Labs", eta: "Yesterday", status: "delivered" },
  { id: "#1039", customer: "Northwind", eta: "Jun 3", status: "pending" },
  { id: "#1038", customer: "Vertex Foods", eta: "Today", status: "transit" },
  { id: "#1036", customer: "Greenline", eta: "May 31", status: "delivered" },
  { id: "#1034", customer: "Atlas Freight", eta: "Jun 4", status: "pending" },
  { id: "#1031", customer: "Bright & Co.", eta: "May 30", status: "delivered" },
  { id: "#1030", customer: "Cedar & Oak", eta: "Jun 5", status: "transit" },
  { id: "#1028", customer: "Pacific Trade", eta: "May 29", status: "delivered" },
  { id: "#1025", customer: "Harbor Goods", eta: "Jun 6", status: "pending" },
  { id: "#1022", customer: "Summit Retail", eta: "May 28", status: "delivered" },
  { id: "#1019", customer: "Delta Works", eta: "Jun 7", status: "transit" },
];
const STATUS_STYLE: Record<string, { dot: string; label: string; text: string }> = {
  transit: { dot: "bg-primary", label: "In transit", text: "text-primary" },
  delivered: { dot: "bg-foreground/40", label: "Delivered", text: "text-muted-foreground" },
  pending: { dot: "bg-foreground/20", label: "Pending", text: "text-muted-foreground" },
};

// Animated KPI counter — counts up from 0 once the dashboard goes live, via
// NumberFlow. respectMotionPreference={false} keeps it animating regardless of
// OS reduced-motion, matching the owner's always-on motion preference.
function KpiValue({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setN(value), 80);
    return () => clearTimeout(t);
  }, [value]);
  return <NumberFlow value={n} respectMotionPreference={false} />;
}

export function MockupProduct({ play = false, startDelay = 0 }: MockupProps) {
  const live = useResolveOnPlay(play, startDelay + 0.6);
  return (
    <Shell title="orders.yourcompany.com">
      {!live ? (
        <Working label="Deploying to production…" />
      ) : (
        <div tabIndex={0} aria-label="Example orders dashboard" className="h-full space-y-2 overflow-y-auto pr-1">
          {/* title + live pill */}
          <motion.div
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <span className="text-[11px] font-semibold text-foreground">Orders</span>
            <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-medium text-primary" style={{ backgroundColor: "rgba(18,0,197,0.12)" }}>
              <span className="h-1 w-1 rounded-full bg-primary" />
              Live
            </span>
          </motion.div>

          {/* orders trend — compact area sparkline (recharts), illustrative */}
          <motion.div
            className="rounded-[8px] border border-foreground/10 px-2 pb-1 pt-1.5"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.3, ease: EASE }}
          >
            <p className="text-[8px] uppercase tracking-[0.06em] text-muted-foreground/70">Orders · 12 days</p>
            <div className="h-9 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ORDER_TREND} accessibilityLayer={false} margin={{ top: 3, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="ord-trend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1200c5" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#1200c5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#1200c5"
                    strokeWidth={1.5}
                    fill="url(#ord-trend)"
                    dot={false}
                    isAnimationActive
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* KPI summary */}
          <div className="grid grid-cols-3 gap-1.5">
            {ORDER_KPIS.map((k, i) => (
              <motion.div
                key={k.label}
                className="rounded-[8px] border border-foreground/10 px-1.5 py-1"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.06, duration: 0.3, ease: EASE }}
              >
                <p className="text-[8px] uppercase tracking-[0.06em] text-muted-foreground/70">{k.label}</p>
                <p className="text-[13px] font-semibold leading-tight text-foreground">
                  <KpiValue value={k.value} />
                </p>
              </motion.div>
            ))}
          </div>

          {/* filter toolbar */}
          <div className="flex items-center gap-1">
            {["All", "In transit", "Delivered"].map((f, i) => (
              <span
                key={f}
                className={`rounded-[8px] px-1.5 py-0.5 text-[8px] ${
                  i === 0 ? "bg-primary/15 text-primary" : "border border-foreground/10 text-muted-foreground"
                }`}
              >
                {f}
              </span>
            ))}
            <span className="ml-auto text-[8px] text-muted-foreground/60">{ORDER_ROWS.length} orders</span>
          </div>

          {/* order list — part of the card's single scroll flow */}
          <div className="overflow-hidden rounded-[8px] border border-foreground/10">
            {ORDER_ROWS.map((o, i) => {
              const s = STATUS_STYLE[o.status];
              return (
                <motion.div
                  key={o.id}
                  className={`flex items-center justify-between px-2 py-1.5 ${i > 0 ? "border-t border-foreground/10" : ""}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.28 + Math.min(i, 4) * 0.08, duration: 0.3, ease: EASE }}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="text-[9px] font-mono text-muted-foreground">{o.id}</span>
                    <span className="truncate text-[9px] text-foreground/85">{o.customer}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[8px] text-muted-foreground/60">{o.eta}</span>
                    <span className={`inline-flex items-center gap-1 text-[8.5px] ${s.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </Shell>
  );
}
