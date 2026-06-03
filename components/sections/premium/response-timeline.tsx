"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

// ============================================================================
// ResponseTimeline — REBUILT to canon (2026-06-01), Vercel-inspired.
// "What to expect after you reach out" as a clean bordered step grid: mono step
// numbers + time, a title, and a one-line description that is ALWAYS visible
// (no auto-cycling, no green status colours, no fabricated stats). Single accent
// (#1200c5), square outer container / 8px inner markers, theme-aware. Steps fade
// up on view, staggered left→right; static under prefers-reduced-motion.
// SSR-safe: all content is always rendered — only opacity/translate animate, so
// the server and first client render match (no hydration mismatch).
// ============================================================================

interface TimelineStep {
  time: string;
  title: string;
  description: string;
}

interface ResponseTimelineProps {
  title?: string;
  subtitle?: string;
  steps: TimelineStep[];
  className?: string;
}

const EASE = [0.32, 0.72, 0, 1] as const;

export function ResponseTimeline({
  title = "What to expect",
  subtitle,
  steps,
  className = "",
}: ResponseTimelineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const reduce = useReducedMotion() ?? false;

  return (
    <section ref={ref} className={`site-section relative overflow-hidden ${className}`}>
      <div className="site-shell relative">
        {/* Header */}
        <motion.div
          className="mx-auto mb-10 max-w-2xl text-center lg:mb-12"
          initial={{ opacity: 0, y: reduce ? 0 : 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="liquid-glass-pill mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Our commitment
          </span>
          <h2 className="site-section-title mb-3">{title}</h2>
          {subtitle && (
            <p className="site-section-copy mx-auto max-w-xl text-muted-foreground">{subtitle}</p>
          )}
        </motion.div>

        {/* Step grid — hairline dividers via gap-px; responsive 1 / 2 / 4 cols */}
        <div className="overflow-hidden border border-foreground/10">
          <div className="grid grid-cols-1 gap-px bg-foreground/10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                className="flex flex-col bg-background p-5 transition-colors duration-300 hover:bg-primary/[0.02] lg:p-6"
                initial={{ opacity: 0, y: reduce ? 0 : 16 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: reduce ? 0 : 0.08 + i * 0.09, ease: EASE }}
              >
                {/* Step marker + time */}
                <div className="mb-5 flex items-center justify-between">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-[8px] font-mono text-[11px] font-medium text-primary"
                    style={{ backgroundColor: "rgba(18,0,197,0.10)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    {step.time}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
