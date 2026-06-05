"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Code2, Eye, Gauge, Smartphone } from "lucide-react";
import { EASE } from "@/lib/motion";

// ============================================================================
// BeforeAfterScan — the /upgrade transformation, told qualitatively.
// Replaces the old version, which fabricated Lighthouse-style scores
// (Performance 45→94, "12 critical issues", "All 43 resolved") and was off the
// design system (rounded-2xl, red/green/blue, shadows, gradients, macOS dots).
// Now: honest qualitative before→after across the dimensions Maxwell rebuilds,
// no invented numbers. Square, flat, single-accent (#1200c5), theme-aware.
// ============================================================================

const DIMENSIONS: { label: string; icon: typeof Gauge; before: string; after: string }[] = [
  { label: "Performance", icon: Gauge, before: "Slow, heavy", after: "Fast and lean" },
  { label: "Accessibility", icon: Eye, before: "Hard to use", after: "Accessible" },
  { label: "Mobile", icon: Smartphone, before: "Patchy on phones", after: "Responsive" },
  { label: "Codebase", icon: Code2, before: "Hard to change", after: "Maintainable, in code" },
];

interface BeforeAfterScanProps {
  className?: string;
}

export function BeforeAfterScan({ className = "" }: BeforeAfterScanProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className={className}>
      {/* header */}
      <motion.div
        className="mx-auto mb-10 max-w-2xl text-center lg:mb-12"
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <span className="liquid-glass-pill mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Before &amp; after
        </span>
        <h2 className="site-section-title mb-3">
          See the <span className="text-muted-foreground">transformation.</span>
        </h2>
        <p className="site-section-copy mx-auto max-w-xl text-muted-foreground">
          Maxwell assesses your current site, then rebuilds it as real, maintainable code — the
          same stack we ship everything else on.
        </p>
      </motion.div>

      {/* before → after panel */}
      <div className="mx-auto max-w-3xl overflow-hidden border border-foreground/10 bg-card/40">
        {/* column heads */}
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-3 sm:px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/55">
            Current site
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
            Rebuilt by Noon
          </span>
        </div>

        {/* rows */}
        <div className="divide-y divide-foreground/10">
          {DIMENSIONS.map((d, i) => {
            const Icon = d.icon;
            return (
              <motion.div
                key={d.label}
                className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4 sm:px-6"
                initial={{ opacity: 0, y: 8 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.1, ease: EASE }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" strokeWidth={1.75} />
                  <span className="text-[13px] font-medium text-foreground">{d.label}</span>
                </div>
                <div className="flex items-center gap-2.5 sm:justify-end">
                  <span className="text-[12.5px] text-muted-foreground">{d.before}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary/60" strokeWidth={2} />
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-foreground">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {d.after}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
