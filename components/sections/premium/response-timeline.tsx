"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { EASE } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

interface TimelineStep {
  time: string;
  title: string;
  description: string;
  status?: "pending" | "active" | "complete";
}

interface ResponseTimelineProps {
  title?: string;
  subtitle?: string;
  steps: TimelineStep[];
  className?: string;
}

// On-brand response timeline: a quiet vertical sequence on a hairline rail,
// revealed once on scroll. Reconciled from the V0 version (rounded-2xl, infinite
// blur glow, ambient gradients, hardcoded rgb, fabricated "<2hrs / 24/7 / 100%"
// stats band) to the flat/hairline system + single accent. The step content is
// owner-supplied; no metrics are invented here.
export function ResponseTimeline({
  title = "What to expect",
  subtitle,
  steps,
  className = "",
}: ResponseTimelineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const reduce = usePrefersReducedMotion();

  return (
    <section className={`site-section ${className}`}>
      <div className="site-shell">
        <div ref={ref} className="mx-auto max-w-3xl">
          {/* header */}
          <div className="mb-10 lg:mb-12 max-w-2xl">
            <span className="site-meta-label inline-flex items-center gap-3 font-mono text-muted-foreground">
              <span className="h-px w-8 bg-foreground/30" />
              What to expect
            </span>
            <h2 className="site-section-title mt-4">{title}</h2>
            {subtitle && <p className="site-section-copy mt-3 text-muted-foreground">{subtitle}</p>}
          </div>

          {/* timeline */}
          <ol className="relative">
            {/* hairline rail behind the nodes */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-[15px] top-3 bottom-3 w-px bg-foreground/12"
            />
            {steps.map((step, i) => (
              <motion.li
                key={`${step.title}-${i}`}
                className="relative flex gap-5 pb-8 last:pb-0"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.45, delay: i * 0.08, ease: EASE }}
              >
                {/* node */}
                <span className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground/15 bg-background">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="font-mono text-[12px] text-primary">{step.time}</span>
                    <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{step.title}</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
