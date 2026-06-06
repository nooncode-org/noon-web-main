"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { Boxes, GitBranch, LifeBuoy, ScanSearch, TrendingUp, User } from "lucide-react";
import { EASE } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useHasMounted } from "@/hooks/use-has-mounted";

// ============================================================================
// DecisionMap — Services as a two-path FLOW diagram (not a radial fan).
//
// A "You" source branches into two labeled, sequential lanes:
//   • Build path:       Custom Development  →  Engineering Support
//   • Improvement path: Business Technology Audit  →  Upgrade
//
// Reference-driven (Linear "milestones" branch diagram + Vercel draw-in /
// crop-mark framing): connectors draw in (pathLength), a token traverses each
// path, and hovering/focusing a lane highlights it while dimming the other.
//
// Geometry (ADR-DM1): the rendered DOM is the single source of truth. Nodes
// flow with normal CSS; an absolutely-positioned SVG overlay draws cubic
// béziers between the MEASURED node anchors (re-measured on resize). No
// CSS-%/viewBox dual coordinate system → no drift, and the same code adapts to
// the desktop lanes and the mobile stack. Nodes are static (no transform) so
// their measured anchor == final position and the links stay visible with no JS.
//
// Reduced motion (ADR-DM2): framer does NOT neutralize pathLength/offsetPath,
// so we gate manually — paths render fully drawn, no token, no loops.
// ============================================================================

const ICONS = {
  boxes: Boxes,
  support: LifeBuoy,
  audit: ScanSearch,
  upgrade: TrendingUp,
} as const;

export interface DecisionStep {
  name: string;
  line: string;
  href: string;
  icon: keyof typeof ICONS;
  meta: string;
  tagline?: string;
}

export interface DecisionPath {
  key: string;
  label: string;
  situation: string;
  prompt: string;
  steps: DecisionStep[];
}

type Segment = { id: string; laneKey: string; order: number; d: string };

// Cubic bézier between two measured node boxes, exiting/entering on the
// DOMINANT axis so curves stay clean whether the layout is horizontal (desktop
// lanes) or vertical (mobile stack). All coordinates are container-local px,
// matching the overlay's viewBox 1:1.
function curveBetween(container: DOMRect, from: DOMRect, to: DOMRect): string {
  const ax0 = from.left - container.left + from.width / 2;
  const ay0 = from.top - container.top + from.height / 2;
  const bx0 = to.left - container.left + to.width / 2;
  const by0 = to.top - container.top + to.height / 2;
  const dx = bx0 - ax0;
  const dy = by0 - ay0;

  let ax: number, ay: number, bx: number, by: number;
  let c1x: number, c1y: number, c2x: number, c2y: number;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // mostly horizontal — leave the right/left edge, horizontal handles
    const s = dx >= 0 ? 1 : -1;
    ax = ax0 + s * (from.width / 2);
    ay = ay0;
    bx = bx0 - s * (to.width / 2);
    by = by0;
    const k = Math.max(24, Math.abs(bx - ax) * 0.5);
    c1x = ax + s * k; c1y = ay;
    c2x = bx - s * k; c2y = by;
  } else {
    // mostly vertical — leave the bottom/top edge, vertical handles
    const s = dy >= 0 ? 1 : -1;
    ax = ax0;
    ay = ay0 + s * (from.height / 2);
    bx = bx0;
    by = by0 - s * (to.height / 2);
    const k = Math.max(20, Math.abs(by - ay) * 0.5);
    c1x = ax; c1y = ay + s * k;
    c2x = bx; c2y = by - s * k;
  }

  const r = (n: number) => Math.round(n * 10) / 10;
  return `M${r(ax)} ${r(ay)} C ${r(c1x)} ${r(c1y)}, ${r(c2x)} ${r(c2y)}, ${r(bx)} ${r(by)}`;
}

export function DecisionMap({
  paths,
  eyebrow,
  title,
  subtitle,
}: {
  paths: DecisionPath[];
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}) {
  const mounted = useHasMounted();
  const reduce = usePrefersReducedMotion();

  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: "-80px" });
  const play = mounted && inView;

  // node id → element, used as the single coordinate source of truth
  const nodeRefs = useRef<Map<string, Element>>(new Map());
  const setNodeRef = useCallback(
    (id: string) => (el: Element | null) => {
      if (el) nodeRefs.current.set(id, el);
      else nodeRefs.current.delete(id);
    },
    [],
  );

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const measure = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const cb = c.getBoundingClientRect();
    setSize({ w: cb.width, h: cb.height });

    const rectOf = (id: string) => nodeRefs.current.get(id)?.getBoundingClientRect();
    const src = rectOf("source");
    // The source is hidden (display:none) on the mobile stack, where its rect
    // collapses to 0×0 at the origin — only fan branches from it when it is
    // actually laid out (desktop), else we'd draw stray corner connectors.
    const srcVisible = !!src && src.width > 0 && src.height > 0;
    const segs: Segment[] = [];

    for (const lane of paths) {
      // branch: source → first step (desktop side-by-side layout only)
      const first = rectOf(`${lane.key}-0`);
      if (srcVisible && first) {
        segs.push({ id: `${lane.key}-branch`, laneKey: lane.key, order: 0, d: curveBetween(cb, src!, first) });
      }
      // sequence: step i → step i+1
      for (let i = 0; i < lane.steps.length - 1; i++) {
        const a = rectOf(`${lane.key}-${i}`);
        const b = rectOf(`${lane.key}-${i + 1}`);
        if (a && b) {
          segs.push({ id: `${lane.key}-seq-${i}`, laneKey: lane.key, order: i + 1, d: curveBetween(cb, a, b) });
        }
      }
    }
    setSegments(segs);
  }, [paths]);

  useEffect(() => {
    measure();
    const c = containerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(c);
    window.addEventListener("resize", measure);
    // Re-measure once web fonts settle (chip widths shift after FOUT).
    const t = window.setTimeout(measure, 300);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.clearTimeout(t);
    };
  }, [measure]);

  const CORNERS = [
    "left-3 top-3 border-l border-t",
    "right-3 top-3 border-r border-t",
    "left-3 bottom-3 border-l border-b",
    "right-3 bottom-3 border-r border-b",
  ] as const;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="relative border border-foreground/15 bg-card/20 p-6 sm:p-8 lg:p-10">
        {/* blueprint crop-marks (Vercel-style technical framing) */}
        {CORNERS.map((c) => (
          <span key={c} aria-hidden className={`pointer-events-none absolute h-2.5 w-2.5 border-foreground/25 ${c}`} />
        ))}

        {/* header — static (always visible). Important copy is never gated
            behind a scroll reveal; the explanatory motion lives in the
            connectors below. */}
        {(eyebrow || title || subtitle) && (
          <div className="mb-8 max-w-2xl">
            {eyebrow && (
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <GitBranch className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                {eyebrow}
              </span>
            )}
            {(title || subtitle) && (
              <h2 className="mt-4 text-[22px] font-semibold leading-snug tracking-[-0.02em] sm:text-[25px] lg:text-[28px]">
                {title && <span className="text-foreground">{title}</span>}{" "}
                {subtitle && <span className="font-normal text-muted-foreground">{subtitle}</span>}
              </h2>
            )}
          </div>
        )}

        {/* diagram area — measured for the connector overlay */}
        <div ref={containerRef} className="relative">
          {/* SVG overlay: client-only (mounted), so server + first client render
              both have zero paths → no hydration mismatch. Decorative. */}
          {mounted && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              width={size.w}
              height={size.h}
              viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
              fill="none"
            >
              <defs>
                <marker
                  id="dm-arrow"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0 L10 5 L0 10 z" fill="var(--color-primary)" />
                </marker>
              </defs>

              {paths.map((lane) => {
                const laneSegs = segments.filter((s) => s.laneKey === lane.key);
                const dim = activeKey !== null && activeKey !== lane.key;
                return (
                  <g key={lane.key} style={{ opacity: dim ? 0.22 : 1, transition: "opacity 220ms ease" }}>
                    {laneSegs.map((seg) =>
                      reduce ? (
                        <path
                          key={seg.id}
                          d={seg.d}
                          stroke="var(--color-primary)"
                          strokeWidth={2}
                          strokeLinecap="round"
                          markerEnd={seg.order > 0 ? "url(#dm-arrow)" : undefined}
                        />
                      ) : (
                        <motion.path
                          key={seg.id}
                          d={seg.d}
                          stroke="var(--color-primary)"
                          strokeWidth={2}
                          strokeLinecap="round"
                          markerEnd={seg.order > 0 ? "url(#dm-arrow)" : undefined}
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={play ? { pathLength: 1, opacity: 1 } : {}}
                          transition={{ duration: 0.55, delay: 0.15 + seg.order * 0.18, ease: EASE }}
                        />
                      ),
                    )}

                    {/* traveling token — single pass on reveal; gentle repeat on
                        the active lane. Never rendered under reduced motion. */}
                    {!reduce &&
                      laneSegs.map((seg) => (
                        <motion.circle
                          key={`${seg.id}-tok`}
                          r={3.5}
                          fill="var(--color-primary)"
                          style={{ offsetPath: `path('${seg.d}')` }}
                          initial={{ offsetDistance: "0%", opacity: 0 }}
                          animate={play ? { offsetDistance: "100%", opacity: [0, 1, 1, 0] } : {}}
                          transition={{
                            duration: 1,
                            delay: 0.55 + seg.order * 0.18,
                            ease: "linear",
                            repeat: activeKey === lane.key ? Infinity : 0,
                            repeatDelay: 0.5,
                          }}
                        />
                      ))}
                  </g>
                );
              })}
            </svg>
          )}

          {/* content layer */}
          <div className="relative z-10 flex flex-col gap-9 md:flex-row md:items-center md:gap-10 lg:gap-14">
            {/* source — desktop only; anchors the branch fan */}
            <div className="hidden md:flex md:shrink-0 md:flex-col md:items-center md:gap-2">
              <span
                ref={setNodeRef("source")}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/15 bg-secondary text-foreground/70"
              >
                <User className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">You</span>
            </div>

            {/* lanes */}
            <div className="flex flex-1 flex-col gap-7 lg:gap-9">
              {paths.map((lane) => {
                const active = activeKey === lane.key;
                return (
                  <div
                    key={lane.key}
                    onMouseEnter={() => setActiveKey(lane.key)}
                    onMouseLeave={() => setActiveKey(null)}
                  >
                    {/* lane heading */}
                    <div className="mb-3">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">{lane.label}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">· {lane.situation}</span>
                      </div>
                      <p className="mt-1 hidden text-[12px] leading-snug text-muted-foreground sm:block">{lane.prompt}</p>
                    </div>

                    <ol className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-12 lg:gap-16">
                      {lane.steps.map((step, i) => {
                        const Icon = ICONS[step.icon];
                        return (
                          <li key={step.name} className="sm:flex-1">
                            <Link
                              ref={setNodeRef(`${lane.key}-${i}`)}
                              href={step.href}
                              aria-label={`${step.name} — ${step.line}`}
                              onFocus={() => setActiveKey(lane.key)}
                              onBlur={() => setActiveKey(null)}
                              className={`group flex h-full items-start gap-3 rounded-[10px] border px-3.5 py-3 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary/45 ${
                                active
                                  ? "border-primary/55 bg-primary/[0.06]"
                                  : "border-foreground/15 bg-secondary/70 hover:border-foreground/25"
                              }`}
                            >
                              <span
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border transition-colors duration-200 ${
                                  active
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : "border-foreground/15 bg-background/60 text-foreground/70"
                                }`}
                              >
                                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                              </span>
                              <span className="min-w-0">
                                <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                  {step.meta}
                                </span>
                                <span className="mt-0.5 block text-[13px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
                                  {step.name}
                                </span>
                                {step.tagline && (
                                  <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
                                    {step.tagline}
                                  </span>
                                )}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
