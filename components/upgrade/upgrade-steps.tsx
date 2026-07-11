"use client";

/**
 * UpgradeSteps — the "Scan / Diagnose / Generate" process cards on /upgrade.
 *
 * Each card carries a small, REAL, animated recreation of what the step does
 * (not a generic icon):
 *   01 Scan     — a mini store page gently scrolls while a scan beam sweeps it;
 *                 REAL elements (hero, each product, testimonial) light up the
 *                 instant the beam physically crosses them (measured positions,
 *                 scroll-aware) — so detections are logical, not random. A
 *                 progress bar + "Analyzing" indicator run.
 *   02 Diagnose — the scored audit runs on a loop: overall score counts up, then
 *                 a review cursor sweeps the rows, filling each metric's meter as
 *                 it's checked, holds, and re-audits — same score chips + priority
 *                 marks as the real <UpgradeAuditPanel> further down the page.
 *   03 Generate — the upgraded site assembles itself: nav, text lines and blocks
 *                 slide / drop into place in sequence while a loading bar fills;
 *                 holds assembled, then clears and loops.
 *
 * Built with the framer-motion already in this file + the page's design tokens
 * (no new deps). Reveals ON SCROLL-INTO-VIEW; only ONE card animates at a time —
 * a spotlight rotates Scan → Diagnose → Generate and resting cards show their
 * finished, static state. The spotlight PAUSES when the section scrolls out of
 * view (perf). The recreations always play (reducedMotion="never") — on this
 * marketing page the motion IS the demonstration, so it runs for everyone.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  MotionConfig,
  useInView,
  useMotionValue,
  useTransform,
  animate,
  type MotionValue,
} from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { EASE } from "@/lib/motion";
import { useRevealMotion } from "@/hooks/use-reveal-motion";

const VIZ_BASE = "relative w-full overflow-hidden rounded-[10px] border border-foreground/10 bg-background/70";
const VIZ = `${VIZ_BASE} h-48`;

/* ── 01 · a live site being scanned ─────────────────────────────────────── */

// px from the beam wrapper's top down to its bright "read" line (h-7 glow above)
const READ_OFFSET = 28;

type ScanRect = { top: number; left: number; width: number; height: number };

// a detection box pinned to a REAL element; lights precisely when the sweeping
// beam crosses that element's current (scroll-shifted) position.
function ScanTarget({
  rect,
  beamY,
  scrollY,
}: {
  rect: ScanRect;
  beamY: MotionValue<number>;
  scrollY: MotionValue<number>;
}) {
  const opacity = useTransform([beamY, scrollY], ([b, s]: number[]) => {
    const line = b + READ_OFFSET; // beam read-line, viewport space
    const center = rect.top + s + rect.height / 2; // element center, viewport space
    const half = rect.height / 2 + 10; // fade window
    const dist = Math.abs(line - center);
    return Math.max(0, Math.min(1, 1 - dist / half));
  });
  return (
    <motion.span
      className="pointer-events-none absolute z-10 rounded-[3px] border border-foreground/55 bg-foreground/[0.05]"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, opacity }}
    />
  );
}

export function ScanViz({ active, className }: { active: boolean; className?: string }) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState<ScanRect[]>([]);
  const scrollY = useMotionValue(0);
  const beamY = useMotionValue(-16);

  // measure the real elements the scanner should "detect" (once, on mount —
  // the viz is fixed-size). Positions are content-space; the boxes scroll with
  // the page, and ScanTarget factors scrollY back in for the beam overlap.
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-scan]");
    setTargets(
      Array.from(els).map((el) => ({
        top: el.offsetTop,
        left: el.offsetLeft,
        width: el.offsetWidth,
        height: el.offsetHeight,
      })),
    );
  }, []);

  // Each turn plays ONE choreographed scan pass (~6s) that ENDS STILL — page
  // scrolled back to the top and beam parked off-screen for the last ~0.9s — so
  // the hand-off to the next card carries no leftover motion. Snaps to rest when
  // it's not this card's turn.
  useEffect(() => {
    if (!active) {
      scrollY.set(0);
      beamY.set(-16);
      return;
    }
    const c1 = animate(scrollY, [0, -110, -110, 0, 0], {
      duration: 6.5,
      times: [0, 0.35, 0.5, 0.85, 1],
      ease: "easeInOut",
    });
    // two calm sweeps, then park at the top and hold through the tail of the turn
    const c2 = animate(beamY, [-16, 150, -16, 150, -16, -16], {
      duration: 6.5,
      times: [0, 0.38, 0.41, 0.79, 0.82, 1],
      ease: "linear",
    });
    return () => {
      c1.stop();
      c2.stop();
    };
  }, [active, scrollY, beamY]);

  const page = (
    <div ref={pageRef} className="relative space-y-2.5 p-2.5">
      {/* nav */}
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-6 rounded-[2px] bg-foreground/20" />
        <div className="ml-1 h-1 w-4 rounded-full bg-foreground/10" />
        <div className="h-1 w-4 rounded-full bg-foreground/10" />
        <div className="h-1 w-4 rounded-full bg-foreground/10" />
        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground/15" />
      </div>
      {/* hero */}
      <div data-scan className="flex items-center gap-2">
        <div className="flex-1 space-y-1">
          <div className="h-2 w-4/5 rounded-full bg-foreground/[0.18]" />
          <div className="h-1 w-3/5 rounded-full bg-foreground/[0.09]" />
          <div className="mt-1 h-2.5 w-10 rounded-full bg-foreground/12" />
        </div>
        <div className="h-12 w-16 rounded-md bg-foreground/[0.07]" />
      </div>
      {/* section label */}
      <div className="mx-auto h-1.5 w-14 rounded-full bg-foreground/12" />
      {/* products row 1 */}
      <div className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} data-scan className="space-y-1">
            <div className="h-8 rounded-sm bg-foreground/[0.06]" />
            <div className="h-1 w-2/3 rounded-full bg-foreground/12" />
          </div>
        ))}
      </div>
      {/* products row 2 */}
      <div className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} data-scan className="space-y-1">
            <div className="h-8 rounded-sm bg-foreground/[0.06]" />
            <div className="h-1 w-2/3 rounded-full bg-foreground/12" />
          </div>
        ))}
      </div>
      {/* testimonial */}
      <div data-scan className="space-y-1 rounded-md bg-foreground/[0.03] p-2">
        <div className="h-1 w-full rounded-full bg-foreground/[0.08]" />
        <div className="h-1 w-4/5 rounded-full bg-foreground/[0.08]" />
      </div>
      {/* footer */}
      <div className="flex items-start gap-2 pt-0.5">
        <div className="h-2 w-8 rounded-[2px] bg-foreground/12" />
        <div className="ml-auto space-y-1">
          <div className="h-1 w-8 rounded-full bg-foreground/[0.08]" />
          <div className="h-1 w-6 rounded-full bg-foreground/[0.08]" />
        </div>
      </div>

      {/* detection boxes — pinned to the measured real elements above */}
      {targets.map((r, i) => (
        <ScanTarget key={i} rect={r} beamY={beamY} scrollY={scrollY} />
      ))}
    </div>
  );

  return (
    <div className={`${VIZ_BASE} flex flex-col ${className ?? "h-48"}`}>
      {/* browser chrome + "Analyzing" indicator */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-foreground/10 bg-foreground/[0.03] px-2.5 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
        <span className="ml-1.5 truncate rounded bg-foreground/[0.06] px-2 py-0.5 font-mono text-[8px] text-muted-foreground">
          acme-logistics.com
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[8px] text-muted-foreground">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-foreground/60"
            animate={active ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.5 }}
            transition={active ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
          />
          Analyzing
        </span>
      </div>

      {/* viewport */}
      <div className="relative flex-1 overflow-hidden">
        {/* analysis progress bar (in time with the scan beam) */}
        <div className="absolute inset-x-0 top-0 z-30 h-0.5 bg-foreground/10">
          <motion.div
            className="h-full origin-left bg-foreground/55"
            initial={{ scaleX: 0 }}
            animate={active ? { scaleX: [0, 1] } : { scaleX: 0 }}
            transition={active ? { duration: 2, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
          />
        </div>

        {/* gently scrolling page (behind the scan) */}
        <motion.div style={{ y: scrollY }}>{page}</motion.div>

        {/* the scan beam — sweeps top → bottom on a loop */}
        <motion.div className="pointer-events-none absolute inset-x-0 top-0 z-20" style={{ y: beamY }}>
          <div className="h-7 bg-gradient-to-b from-transparent to-foreground/[0.14]" />
          <div className="h-px w-full bg-foreground/80" />
          <div className="h-2 bg-gradient-to-b from-foreground/[0.10] to-transparent" />
        </motion.div>
      </div>
    </div>
  );
}

/* ── 02 · the scored audit (mirrors the real UpgradeAuditPanel) ──────────── */
const DIAGNOSE_ROWS = [
  { label: "Messaging", score: 5, warn: true },
  { label: "Trust & credibility", score: 4, warn: true },
  { label: "Conversion", score: 6, warn: false },
  { label: "Visual design", score: 8, warn: false },
  { label: "Page speed", score: 3, warn: true },
] as const;

function chipClass(score: number) {
  return score >= 7
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : score >= 5
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}
function barClass(score: number) {
  return score >= 7 ? "bg-green-500" : score >= 5 ? "bg-yellow-500" : "bg-red-500";
}

function CountUp({ to, active }: { to: number; active: boolean }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  useEffect(() => {
    if (active) {
      mv.set(0);
      const controls = animate(mv, to, { duration: 1.6, ease: EASE });
      return () => controls.stop();
    }
    // resting (not this card's turn): show the final score
    mv.set(to);
  }, [active, to, mv]);
  return <motion.span>{rounded}</motion.span>;
}

// audit "review" loop: a cursor sweeps the rows top→bottom; each row's meter
// fills as it's reached, holds while assembled, then all reset and it re-audits.
const DIAG_CYCLE = 8; // seconds per audit pass
const DIAG_START = 0.2; // when the first row is reviewed
const DIAG_STEP = 1.1; // gap between rows being reviewed
const DIAG_FILL = 0.9; // how long a meter takes to fill

export function DiagnoseViz({ active, className }: { active: boolean; className?: string }) {
  return (
    <div className={`${VIZ_BASE} ${className ?? "h-48"} p-3`}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground/50">6 pages · 3 critical issues</span>
        <span className="text-lg font-semibold leading-none tabular-nums text-foreground">
          <CountUp to={6} active={active} />
          <span className="text-[11px] font-normal text-muted-foreground">/10</span>
        </span>
      </div>

      <div className="space-y-1.5">
        {DIAGNOSE_ROWS.map((r, i) => {
          const t = DIAG_START + i * DIAG_STEP;
          const barTimes = [0, t / DIAG_CYCLE, (t + DIAG_FILL) / DIAG_CYCLE, 0.9, 1];
          const hlTimes = [0, t / DIAG_CYCLE, (t + 0.35) / DIAG_CYCLE, (t + 0.9) / DIAG_CYCLE, 1];
          return (
            <motion.div
              key={r.label}
              className="relative flex items-center gap-2"
              // rows render in place with no entrance — the review cursor + meter
              // fills (only while this card is spotlighted) carry the animation
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              {/* review cursor — a soft highlight passing down the rows */}
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
                className={`relative inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${chipClass(r.score)}`}
              >
                {r.score}/10
              </span>
              <span className="relative min-w-0 flex-1 truncate text-[12px] text-foreground/80">{r.label}</span>
              <span className="relative h-1 w-7 shrink-0 overflow-hidden rounded-full bg-foreground/10">
                <motion.span
                  className={`block h-full rounded-full ${barClass(r.score)}`}
                  style={{ originX: 0 }}
                  initial={false}
                  animate={active ? { scaleX: [0, 0, r.score / 10, r.score / 10, 0] } : { scaleX: r.score / 10 }}
                  transition={
                    active
                      ? { duration: DIAG_CYCLE, times: barTimes, repeat: Infinity, ease: "easeOut", repeatDelay: 0.3 }
                      : { duration: 0.4, ease: EASE }
                  }
                />
              </span>
              {r.warn ? (
                <AlertTriangle className="relative h-3 w-3 shrink-0 text-destructive/80" strokeWidth={1.9} />
              ) : (
                <CheckCircle2 className="relative h-3 w-3 shrink-0 text-green-500" strokeWidth={1.9} />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 03 · the upgraded site being generated block by block ──────────────── */

// One placeable piece. Stays hidden until its turn, then snaps into place:
// texts slide in from the left, blocks drop + pop. Every piece shares ONE build
// cycle (synchronized keyframe `times`) so they assemble in order, hold, clear,
// and loop together.
const GEN_CYCLE = 8; // seconds per build loop
const GEN_START = 0.15; // when the first piece lands
const GEN_STEP = 0.5; // gap between successive pieces landing
const GEN_SNAP = 0.7; // how long a single piece takes to snap in

function BuildPiece({
  order,
  active,
  slide = false,
  className,
  children,
}: {
  order: number;
  active: boolean;
  slide?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const appearStart = GEN_START + order * GEN_STEP;
  const appearEnd = appearStart + GEN_SNAP;
  const times = [0, appearStart / GEN_CYCLE, appearEnd / GEN_CYCLE, 0.86, 0.96, 1];
  const shown = slide ? { opacity: 1, x: 0 } : { opacity: 1, y: 0, scale: 1 };
  const keyframes = slide
    ? { opacity: [0, 0, 1, 1, 0, 0], x: [-8, -8, 0, 0, 0, -8] }
    : { opacity: [0, 0, 1, 1, 0, 0], y: [8, 8, 0, 0, 0, 8], scale: [0.94, 0.94, 1, 1, 1, 0.94] };
  return (
    <motion.div
      className={className}
      // initial={false}: a resting piece renders already in place (NO entrance —
      // only the spotlighted card builds); an active piece starts from the
      // keyframes' hidden first frame and builds in.
      initial={false}
      // active → build loop; resting → settled into its finished position
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

// when the last piece (order 10) has finished snapping in, as a fraction of
// the cycle — the loading bar reaches 100% exactly here.
const GEN_BUILD_DONE = (GEN_START + 10 * GEN_STEP + GEN_SNAP) / GEN_CYCLE;

export function GenerateViz({ active, className }: { active: boolean; className?: string }) {
  return (
    <div className={`${VIZ_BASE} ${className ?? "h-48"}`}>
      {/* generation loading bar — fills as the pieces are placed, holds full while
          the site is assembled, then drains as it clears to loop */}
      <div className="absolute inset-x-0 top-0 z-30 h-0.5 bg-foreground/10">
        <motion.div
          className="h-full origin-left bg-foreground/55"
          initial={false}
          animate={active ? { scaleX: [0, 1, 1, 0, 0] } : { scaleX: 1 }}
          transition={
            active
              ? {
                  duration: GEN_CYCLE,
                  times: [0, GEN_BUILD_DONE, 0.86, 0.96, 1],
                  repeat: Infinity,
                  ease: "linear",
                  repeatDelay: 0.4,
                }
              : { duration: 0.4, ease: "linear" }
          }
        />
      </div>

      <div className="absolute inset-0 p-2.5">
        {/* nav — drops in first */}
        <BuildPiece order={0} active={active} className="mb-2.5 flex items-center gap-2">
          <div className="h-2 w-7 rounded-full bg-foreground/25" />
          <div className="ml-auto h-1 w-4 rounded-full bg-foreground/12" />
          <div className="h-1 w-4 rounded-full bg-foreground/12" />
          <div className="h-1 w-4 rounded-full bg-foreground/12" />
        </BuildPiece>

        {/* hero — text lines slide in from the left, media block drops in */}
        <div className="mb-2.5 flex items-start gap-2.5">
          <div className="flex-1 space-y-1.5 pt-0.5">
            <BuildPiece order={1} active={active} slide className="h-2 w-3/4 rounded-full bg-foreground/30" />
            <BuildPiece order={2} active={active} slide className="h-1 w-1/2 rounded-full bg-foreground/12" />
            <BuildPiece order={3} active={active} slide className="mt-1 h-2.5 w-10 rounded-full bg-foreground/15" />
          </div>
          <BuildPiece order={4} active={active} className="h-12 w-16 rounded-lg bg-foreground/[0.07]" />
        </div>

        {/* products — each card drops into place in turn */}
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <BuildPiece key={i} order={5 + i} active={active} className="space-y-1.5">
              <div className="h-6 rounded-md bg-foreground/[0.06]" />
              <div className="h-1 w-3/4 rounded-full bg-foreground/15" />
            </BuildPiece>
          ))}
        </div>

        {/* testimonial — fills out the page so it reads as a full site, not
            just a hero + products fragment */}
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

        {/* restrained accent — placed last */}
        <BuildPiece order={10} active={active} className="mt-1.5 h-1 w-9 rounded-full bg-green-500/70" />
      </div>
    </div>
  );
}

const STEPS = [
  {
    step: "01",
    title: "Scan",
    description:
      "We analyze your live website for performance, accessibility, UI/UX issues, and conversion opportunities.",
    Viz: ScanViz,
  },
  {
    step: "02",
    title: "Diagnose",
    description:
      "Maxwell identifies specific improvements with detailed recommendations and priority rankings.",
    Viz: DiagnoseViz,
  },
  {
    step: "03",
    title: "Generate",
    description:
      "Get a fully upgraded version of your site with all improvements applied, ready for review.",
    Viz: GenerateViz,
  },
] as const;

// each card's turn (ms) — UNIFIED so all three run at the same, calmer pace, and
// each ends while its card sits in its finished, RESTING state (never mid
// loop-reset) so the hand-off carries no leftover motion. Scan: a 6.5s scan pass
// (ends at the top, beam parked). Diagnose/Generate: meters/pieces finish (~4.5s)
// then hold assembled until the turn ends.
const TURN_MS = [6500, 6500, 6500];

export function UpgradeSteps() {
  // Reveal once on scroll-into-view; SSR-safe (see useRevealMotion).
  const { ref, show } = useRevealMotion({ margin: "-80px" });
  // Live visibility — the spotlight only runs while the section is on screen, so
  // the loops don't burn CPU forever once revealed (useRevealMotion latches).
  const inView = useInView(ref);

  // Only one card animates at a time; the spotlight rotates through the three.
  // Resting cards render their finished, static state (handled inside each viz).
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    if (!show || !inView) return;
    const id = setTimeout(() => setActiveIndex((i) => (i + 1) % STEPS.length), TURN_MS[activeIndex]);
    return () => clearTimeout(id);
  }, [show, inView, activeIndex]);

  return (
    // reducedMotion="never" — these are DEMO recreations where the motion IS the
    // message (a marketing page illustrating scan → diagnose → generate), so they
    // always play, even for visitors with OS "reduce motion" on. The app-wide
    // provider (motion-provider.tsx) would otherwise freeze them.
    <MotionConfig reducedMotion="never">
      {/* No wrapping div — the cards are real grid items of the PARENT grid
          (.upg-steps-frame in page.tsx), sharing its actual column tracks.
          That's what lets the divider between cards be a real grid item too
          (see .upg-steps-divider) instead of a separately positioned line
          with a hand-measured height. `ref` goes on the first card itself
          (a real, laid-out element) rather than a wrapper: a previous
          display:contents wrapper had no box for IntersectionObserver to
          measure, so `inView` never resolved and the reveal + active-card
          rotation both got stuck. */}
      {STEPS.map((item, index) => (
        <motion.div
          key={item.step}
          ref={index === 0 ? ref : undefined}
          className={`step-card step-card-${index} group border-t border-b border-foreground/10 bg-card/50 p-5 transition-colors duration-300 hover:bg-foreground/[0.03]`}
          initial={false}
          animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, delay: 0.1 + index * 0.12, ease: EASE }}
        >
          <div className="mb-4">
            <item.Viz active={show && inView && activeIndex === index} />
          </div>
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground/50">{item.step}</span>
            <h3 className="text-lg font-medium tracking-tight text-foreground">{item.title}</h3>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        </motion.div>
      ))}
    </MotionConfig>
  );
}
