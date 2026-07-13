"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, MotionConfig, useMotionValue, useTransform, animate, type MotionValue } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

const VIZ =
  "relative w-full h-[380px] overflow-hidden rounded-[10px] border border-foreground/10 bg-background/70";

// ── Scan detection helpers ────────────────────────────────────────────────────
// Distance from beam wrapper top to the actual read-line (h-10 glow above beam)
const READ_OFFSET = 40;
type ScanRect = { top: number; left: number; width: number; height: number };

function ScanTarget({
  rect, beamY, scrollY,
}: {
  rect: ScanRect;
  beamY: MotionValue<number>;
  scrollY: MotionValue<number>;
}) {
  const opacity = useTransform([beamY, scrollY], ([b, s]: number[]) => {
    const line   = (b as number) + READ_OFFSET;
    const center = rect.top + (s as number) + rect.height / 2;
    const half   = rect.height / 2 + 12;
    return Math.max(0, Math.min(1, 1 - Math.abs(line - center) / half));
  });
  return (
    <motion.span
      className="pointer-events-none absolute z-10 rounded-[4px] border border-foreground/55 bg-foreground/[0.05]"
      style={{
        top: rect.top, left: rect.left,
        width: rect.width, height: rect.height,
        opacity,
      }}
    />
  );
}

// ── 01 · Scan ─────────────────────────────────────────────────────────────────
function ScanPanel({ active }: { active: boolean }) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState<ScanRect[]>([]);
  const scrollY = useMotionValue(0);
  const beamY   = useMotionValue(-24);

  // Measure data-scan elements once on mount (layout is static)
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-scan]");
    setTargets(
      Array.from(els).map((el) => ({
        top:    el.offsetTop,
        left:   el.offsetLeft,
        width:  el.offsetWidth,
        height: el.offsetHeight,
      })),
    );
  }, []);

  useEffect(() => {
    if (!active) {
      scrollY.set(0);
      beamY.set(-24);
      return;
    }
    const c1 = animate(scrollY, [0, -180, -180, 0, 0], {
      duration: 6.5,
      times: [0, 0.35, 0.5, 0.85, 1],
      ease: "easeInOut",
    });
    const c2 = animate(beamY, [-24, 310, -24, 310, -24, -24], {
      duration: 6.5,
      times: [0, 0.38, 0.41, 0.79, 0.82, 1],
      ease: "linear",
    });
    return () => {
      c1.stop();
      c2.stop();
    };
  }, [active, scrollY, beamY]);

  return (
    <div className={`${VIZ} flex flex-col`}>
      {/* Browser chrome */}
      <div className="flex shrink-0 items-center gap-2 border-b border-foreground/10 bg-foreground/[0.03] px-3 py-2.5">
        <span className="h-2 w-2 rounded-full bg-foreground/20" />
        <span className="h-2 w-2 rounded-full bg-foreground/20" />
        <span className="h-2 w-2 rounded-full bg-foreground/20" />
        <span className="ml-2.5 flex-1 truncate rounded bg-foreground/[0.06] px-2.5 py-1 font-mono text-[10px] text-foreground/45">
          acme-logistics.com
        </span>
        <span className="ml-2.5 flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-foreground/45">
          <motion.span
            className="h-2 w-2 rounded-full bg-foreground/60"
            animate={active ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.5 }}
            transition={
              active
                ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.3 }
            }
          />
          Analyzing
        </span>
      </div>

      {/* Viewport */}
      <div className="relative flex-1 overflow-hidden">
        {/* Scrolling page — ref on inner static div for position measurement */}
        <motion.div style={{ y: scrollY }}>
          <div ref={pageRef} className="relative space-y-3.5 p-4">
            {/* Nav */}
            <div className="flex items-center gap-2">
              <div className="h-3 w-9 rounded-[2px] bg-foreground/22" />
              <div className="ml-2 h-1.5 w-6 rounded-full bg-foreground/10" />
              <div className="h-1.5 w-6 rounded-full bg-foreground/10" />
              <div className="h-1.5 w-6 rounded-full bg-foreground/10" />
              <div className="ml-auto h-5 w-14 rounded-full bg-foreground/12" />
            </div>
            {/* Hero */}
            <div data-scan className="flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-4/5 rounded-full bg-foreground/[0.20]" />
                <div className="h-1.5 w-3/5 rounded-full bg-foreground/[0.10]" />
                <div className="mt-2 h-4 w-16 rounded-full bg-foreground/14" />
              </div>
              <div className="h-16 w-20 shrink-0 rounded-lg bg-foreground/[0.07]" />
            </div>
            {/* Products row 1 */}
            <div data-scan className="grid grid-cols-3 gap-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-14 rounded-md bg-foreground/[0.07]" />
                  <div className="h-1.5 w-3/4 rounded-full bg-foreground/12" />
                  <div className="h-1 w-1/2 rounded-full bg-foreground/[0.07]" />
                </div>
              ))}
            </div>
            {/* Products row 2 */}
            <div data-scan className="grid grid-cols-3 gap-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-14 rounded-md bg-foreground/[0.07]" />
                  <div className="h-1.5 w-3/4 rounded-full bg-foreground/12" />
                  <div className="h-1 w-1/2 rounded-full bg-foreground/[0.07]" />
                </div>
              ))}
            </div>
            {/* Testimonial */}
            <div data-scan className="rounded-md bg-foreground/[0.04] p-3 space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-foreground/[0.09]" />
              <div className="h-1.5 w-4/5 rounded-full bg-foreground/[0.09]" />
            </div>
            {/* Footer */}
            <div className="flex items-start gap-3 pt-1">
              <div className="h-2.5 w-10 rounded-[2px] bg-foreground/14" />
              <div className="ml-auto space-y-1.5">
                <div className="h-1.5 w-12 rounded-full bg-foreground/[0.08]" />
                <div className="h-1 w-8 rounded-full bg-foreground/[0.08]" />
              </div>
            </div>

            {/* Detection overlays — positioned relative to pageRef */}
            {targets.map((r, i) => (
              <ScanTarget key={i} rect={r} beamY={beamY} scrollY={scrollY} />
            ))}
          </div>
        </motion.div>

        {/* Scan beam */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 z-20"
          style={{ y: beamY }}
        >
          <div className="h-10 bg-gradient-to-b from-transparent to-foreground/[0.12]" />
          <div className="h-px w-full bg-foreground/80" />
          <div className="h-4 bg-gradient-to-b from-foreground/[0.08] to-transparent" />
        </motion.div>
      </div>
    </div>
  );
}

// ── 01b · Loading ────────────────────────────────────────────────────────────
function LoadingPanel(_: { active: boolean }) {
  return (
    <div className={`${VIZ} flex items-center justify-center`}>
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

// ── 02 · Diagnose ─────────────────────────────────────────────────────────────
const DIAG_CYCLE = 8;
const DIAG_START = 0.2;
const DIAG_STEP_T = 1.1;
const DIAG_FILL = 0.9;

const DIAG_ROWS = [
  { label: "Messaging clarity",   score: 5, warn: true },
  { label: "Trust & credibility", score: 4, warn: true },
  { label: "Conversion rate",     score: 6, warn: false },
  { label: "Visual design",       score: 8, warn: false },
  { label: "Page speed",          score: 3, warn: true },
] as const;

function chipCls(s: number) {
  return s >= 7
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : s >= 5
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}
function barCls(s: number) {
  return s >= 7 ? "bg-green-500" : s >= 5 ? "bg-yellow-500" : "bg-red-500";
}

function DiagnosePanel({ active }: { active: boolean }) {
  return (
    <div className={`${VIZ} flex flex-col p-4`}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <span className="text-[15px] font-medium leading-none text-foreground">Audit report</span>
          <span className="mt-1.5 block font-mono text-[10px] text-foreground/45/45">8 pages · 3 critical issues</span>
        </div>
        <span className="text-2xl font-semibold leading-none tabular-nums text-foreground">
          5<span className="text-sm font-normal text-foreground/45">/10</span>
        </span>
      </div>
      <div className="space-y-2.5">
        {DIAG_ROWS.map((r, i) => {
          const t = DIAG_START + i * DIAG_STEP_T;
          const barTimes = [0, t / DIAG_CYCLE, (t + DIAG_FILL) / DIAG_CYCLE, 0.9, 1];
          const hlTimes  = [0, t / DIAG_CYCLE, (t + 0.35) / DIAG_CYCLE, (t + 0.9) / DIAG_CYCLE, 1];
          return (
            <motion.div
              key={r.label}
              className="relative flex items-center gap-2.5"
              initial={false}
              animate={{ opacity: 1 }}
            >
              <motion.span
                className="pointer-events-none absolute -inset-x-1.5 -inset-y-0.5 rounded bg-foreground/[0.07]"
                initial={{ opacity: 0 }}
                animate={active ? { opacity: [0, 0, 1, 0, 0] } : { opacity: 0 }}
                transition={
                  active
                    ? { duration: DIAG_CYCLE, times: hlTimes, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.3 }
                    : { duration: 0.3 }
                }
              />
              <span
                className={`relative inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${chipCls(r.score)}`}
              >
                {r.score}/10
              </span>
              <span className="relative min-w-0 flex-1 truncate text-[13px] text-foreground/80">
                {r.label}
              </span>
              <span className="relative h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-foreground/10">
                <motion.span
                  className={`block h-full rounded-full ${barCls(r.score)}`}
                  style={{ originX: 0 }}
                  initial={false}
                  animate={
                    active
                      ? { scaleX: [0, 0, r.score / 10, r.score / 10, 0] }
                      : { scaleX: r.score / 10 }
                  }
                  transition={
                    active
                      ? { duration: DIAG_CYCLE, times: barTimes, repeat: Infinity, ease: "easeOut", repeatDelay: 0.3 }
                      : { duration: 0.4 }
                  }
                />
              </span>
              {r.warn ? (
                <AlertTriangle className="relative h-3.5 w-3.5 shrink-0 text-destructive/80" strokeWidth={1.9} />
              ) : (
                <CheckCircle2 className="relative h-3.5 w-3.5 shrink-0 text-green-500" strokeWidth={1.9} />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── 03 · Generate ─────────────────────────────────────────────────────────────
const GEN_CYCLE  = 8;
const GEN_START  = 0.15;
const GEN_STEP   = 0.5;
const GEN_SNAP   = 0.7;
const GEN_BUILD_DONE = (GEN_START + 10 * GEN_STEP + GEN_SNAP) / GEN_CYCLE;

function BuildPiece({
  order, active, slide = false, className, children,
}: {
  order: number; active: boolean; slide?: boolean; className?: string; children?: ReactNode;
}) {
  const appearStart = GEN_START + order * GEN_STEP;
  const appearEnd   = appearStart + GEN_SNAP;
  const times = [0, appearStart / GEN_CYCLE, appearEnd / GEN_CYCLE, 0.86, 0.96, 1];
  const keyframes = slide
    ? { opacity: [0, 0, 1, 1, 0, 0], x: [-10, -10, 0, 0, 0, -10] }
    : { opacity: [0, 0, 1, 1, 0, 0], y: [10, 10, 0, 0, 0, 10], scale: [0.94, 0.94, 1, 1, 1, 0.94] };
  const shown = slide ? { opacity: 1, x: 0 } : { opacity: 1, y: 0, scale: 1 };
  return (
    <motion.div
      className={className}
      initial={false}
      animate={active ? keyframes : shown}
      transition={
        active
          ? { duration: GEN_CYCLE, times, repeat: Infinity, ease: "easeOut", repeatDelay: 0.4 }
          : { duration: 0.4, ease: "easeOut" }
      }
    >
      {children}
    </motion.div>
  );
}

function GeneratePanel({ active }: { active: boolean }) {
  return (
    <div className={VIZ}>
      <div className="absolute inset-0 p-5">
        {/* Nav */}
        <BuildPiece order={0} active={active} className="mb-4 flex items-center gap-2">
          <div className="h-3 w-10 rounded-full bg-foreground/25" />
          <div className="ml-auto flex items-center gap-1.5">
            <div className="h-1.5 w-5 rounded-full bg-foreground/12" />
            <div className="h-1.5 w-5 rounded-full bg-foreground/12" />
            <div className="h-5 w-14 rounded-full bg-foreground/18" />
          </div>
        </BuildPiece>
        {/* Hero — full-width, no side image */}
        <BuildPiece order={1} active={active} className="mb-3 rounded-lg bg-foreground/[0.05] p-3.5">
          <div className="space-y-2">
            <div className="h-4 w-3/4 rounded-full bg-foreground/28" />
            <div className="h-2 w-1/2 rounded-full bg-foreground/12" />
            <div className="mt-2 flex items-center gap-2">
              <div className="h-5 w-16 rounded-full bg-foreground/18" />
              <div className="h-5 w-12 rounded-full bg-foreground/[0.07]" />
            </div>
          </div>
        </BuildPiece>
        {/* KPI row — 3 metric tiles */}
        <div className="mb-3 grid grid-cols-3 gap-2.5">
          {[
            { w: "w-10" },
            { w: "w-8" },
            { w: "w-9" },
          ].map((k, i) => (
            <BuildPiece key={i} order={2 + i} active={active} className="rounded-md bg-foreground/[0.06] p-2.5 space-y-1.5">
              <div className={`h-4 ${k.w} rounded-full bg-foreground/25`} />
              <div className="h-1.5 w-12 rounded-full bg-foreground/10" />
            </BuildPiece>
          ))}
        </div>
        {/* Order table */}
        <BuildPiece order={5} active={active} className="rounded-md bg-foreground/[0.04] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-foreground/[0.06] px-3 py-1.5">
            <div className="h-1.5 w-16 rounded-full bg-foreground/18" />
            <div className="ml-auto h-1.5 w-8 rounded-full bg-foreground/10" />
          </div>
          {[0, 1, 2].map((i) => (
            <BuildPiece key={i} order={6 + i} active={active}
              className="flex items-center gap-2.5 border-b border-foreground/[0.04] px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-foreground/15" />
              <div className="h-1.5 w-16 rounded-full bg-foreground/15" />
              <div className="ml-auto h-1.5 w-10 rounded-full bg-foreground/10" />
              <div className="h-4 w-10 rounded-full bg-green-500/20" />
            </BuildPiece>
          ))}
        </BuildPiece>
        {/* Green accent */}
        <BuildPiece order={10} active={active} className="mt-3 h-2 w-12 rounded-full bg-green-500/70" />
      </div>
    </div>
  );
}

// ── UpgradeFlow ───────────────────────────────────────────────────────────────
const STEPS = [
  { key: "scan",     duration: 6500, Panel: ScanPanel },
  { key: "loading",  duration: 2000, Panel: LoadingPanel },
  { key: "diagnose", duration: 6500, Panel: DiagnosePanel },
  { key: "generate", duration: 6500, Panel: GeneratePanel },
] as const;

export function UpgradeFlow() {
  const [index, setIndex]   = useState(0);
  // active arranca true y se re-eleva junto con el avance de indice (nunca un
  // setState sincrono dentro del efecto — regla de cascading renders del lint).
  const [active, setActive] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => {
      setActive(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % STEPS.length);
        setActive(true);
      }, 350);
    }, STEPS[index].duration);
    return () => clearTimeout(id);
  }, [index]);

  const step = STEPS[index];
  const { Panel } = step;

  return (
    <MotionConfig reducedMotion="never">
      <div style={{ flex: 1, minWidth: 0, maxWidth: 560, height: 420, overflow: "hidden", position: "relative" }}>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-48"
          style={{ background: "linear-gradient(to bottom, transparent, var(--background))", zIndex: 50 }}
        />
        <div style={{ marginTop: 84 }}>
          {/* initial={false} = sin animacion de entrada SOLO en el primer mount
              (reemplaza el ref firstRender leido en render, que rompia lint) */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <Panel active={active} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
