"use client";

import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Check, Minus, LoaderCircle, ClipboardList, Layers, Code2, Rocket, Circle } from "lucide-react";

// ============================================================================
// ComparisonShowcase — REBUILT to canon + dynamic content states (2026-06-01).
// Honest before/after: the friction of the traditional approach on the left,
// how Noon resolves each one on the right. The Noon column is ALIVE — when the
// section scrolls into view, each dimension shows a brief "resolving…" state
// (shimmer) that transitions into the resolved outcome with a check landing,
// staggered top→bottom (mirrors the pipeline's loading→resolved language).
// Theme-aware, single-accent (#1200c5), square. Static under reduced motion.
// Loaded client-only (next/dynamic ssr:false in /about) so it can animate from
// a non-final state without hydration conflicts.
// ============================================================================

interface ComparisonItem {
  label: string;
  traditional: string;
  noon: string;
}

interface ComparisonShowcaseProps {
  title?: string;
  subtitle?: string;
  items: ComparisonItem[];
  className?: string;
}

const EASE = [0.32, 0.72, 0, 1] as const;

// Per-dimension iconography so the comparison is scannable at a glance.
// Maps the known /about dimensions; falls back to a neutral dot.
const DIMENSION_ICONS: Record<string, typeof Check> = {
  Requirements: ClipboardList,
  Prototyping: Layers,
  Development: Code2,
  Delivery: Rocket,
};

function toPoints(block: string): string[] {
  return block
    .split("\n")
    .map((l) => l.replace(/^→\s*/, "").trim())
    .filter(Boolean);
}

// One Noon dimension: brief "resolving…" → resolved points (checks land).
function NoonRow({ label, block, play, reduce, delay }: { label: string; block: string; play: boolean; reduce: boolean; delay: number }) {
  const points = toPoints(block);
  // The loading → resolved content transition is informational → runs on view
  // regardless of prefers-reduced-motion. `reduce` only disables the check's
  // spring scale below (large movement).
  const [resolved, setResolved] = useState(!play);

  useEffect(() => {
    if (!play) {
      setResolved(true);
      return;
    }
    setResolved(false);
    const t = setTimeout(() => setResolved(true), delay * 1000 + 850);
    return () => clearTimeout(t);
  }, [play, delay]);

  const Icon = DIMENSION_ICONS[label] ?? Circle;
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-primary/80">
        <Icon className="h-3 w-3" strokeWidth={1.75} />
        {label}
      </p>
      <AnimatePresence mode="wait" initial={false}>
        {resolved ? (
          <motion.ul
            key="resolved"
            className="space-y-1.5"
            initial={{ opacity: reduce ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {points.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm leading-snug text-foreground/90">
                <motion.span
                  className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-primary"
                  style={{ backgroundColor: "rgba(18,0,197,0.12)" }}
                  initial={{ scale: reduce ? 1 : 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: reduce ? 0 : i * 0.07, type: "spring", stiffness: 460, damping: 22 }}
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </motion.span>
                <span>{p}</span>
              </li>
            ))}
          </motion.ul>
        ) : (
          <motion.div
            key="resolving"
            className="flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <LoaderCircle className="h-3 w-3 animate-spin text-primary" />
            <span
              className="bg-clip-text font-mono text-[11px] text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--muted-foreground) 0%, var(--foreground) 50%, var(--muted-foreground) 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.1s linear infinite",
              }}
            >
              Resolving with Noon…
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ComparisonShowcase({
  title = "The difference",
  subtitle,
  items,
  className = "",
}: ComparisonShowcaseProps) {
  const ref = useRef<HTMLDivElement>(null);
  // once:false → the Noon column re-resolves each time the section enters view.
  const inView = useInView(ref, { margin: "-100px" });
  const reduce = useReducedMotion() ?? false;
  const play = inView;

  return (
    <section ref={ref} className={`site-section relative overflow-hidden ${className}`}>
      <div className="site-shell relative">
        {/* Header */}
        <motion.div
          className="mx-auto mb-10 max-w-2xl text-center lg:mb-12"
          initial={{ opacity: 0, y: reduce ? 0 : 14 }}
          animate={play ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="liquid-glass-pill mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Why Noon
          </span>
          <h2 className="site-section-title mb-3">{title}</h2>
          {subtitle && <p className="site-section-copy mx-auto max-w-xl text-muted-foreground">{subtitle}</p>}
        </motion.div>

        {/* Comparison — single bordered card, two columns + divider */}
        <div className="overflow-hidden border border-foreground/10 bg-card/40">
          <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-foreground/10">
            {/* Traditional (muted) — points slide in, staggered */}
            <div className="p-6 lg:p-8">
              <p className="mb-6 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-[6px] border border-foreground/15 bg-secondary/40">
                  <Minus className="h-3 w-3" />
                </span>
                Traditional approach
              </p>
              <div className="space-y-5">
                {items.map((item, di) => {
                  const DimIcon = DIMENSION_ICONS[item.label] ?? Circle;
                  return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                    animate={play ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.4, delay: reduce ? 0 : di * 0.1, ease: EASE }}
                  >
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
                      <DimIcon className="h-3 w-3" strokeWidth={1.75} />
                      {item.label}
                    </p>
                    <ul className="space-y-1.5">
                      {toPoints(item.traditional).map((p, i) => (
                        <li key={i} className="flex gap-2 text-sm leading-snug text-muted-foreground">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                  );
                })}
              </div>
            </div>

            {/* With Noon (accent) — each dimension resolves: loading → checks */}
            <div className="bg-primary/[0.03] p-6 lg:p-8">
              <p className="mb-6 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-primary">
                <span className="flex h-5 w-5 items-center justify-center rounded-[6px] text-primary" style={{ backgroundColor: "rgba(18,0,197,0.12)" }}>
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                With Noon
              </p>
              <div className="space-y-5">
                {items.map((item, di) => (
                  <NoonRow key={item.label} label={item.label} block={item.noon} play={play} reduce={reduce} delay={0.3 + di * 0.55} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
