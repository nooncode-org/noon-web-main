"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { DollarSign, Layers, Settings, ShoppingCart } from "lucide-react";
import { EASE } from "@/lib/motion";

// ============================================================================
// ContactRouteDiagram — /opportunities "one contact route for all paths" made
// visual: the four ecosystem tracks (Invest / Sellers / Developers / Partners)
// converge into a single Noon node. Replaces a decorative iso-cube that didn't
// communicate anything. Same visual language as the Services decision-map
// (SVG viewBox 0–100 + non-scaling-stroke straight connectors + %-positioned
// HTML nodes), flat, single-accent (#1200c5), theme-aware, motion always-on.
// ============================================================================

const HUB = { x: 80, y: 50 };
const TRACK_X = 14;
const ROW_Y = [14, 38, 62, 86] as const;

const TRACKS = [
  { label: "Invest", icon: DollarSign },
  { label: "Sellers", icon: ShoppingCart },
  { label: "Developers", icon: Settings },
  { label: "Partners", icon: Layers },
] as const;

export function ContactRouteDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref} className="overflow-hidden rounded-[8px] border border-foreground/10 bg-card/40 px-5 py-6 lg:px-6">
      <div className="relative h-[240px] w-full">
        <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
          {ROW_Y.map((y, i) => (
            <motion.line
              key={y}
              x1={TRACK_X + 3}
              y1={y}
              x2={HUB.x - 5}
              y2={HUB.y}
              stroke="var(--color-primary)"
              strokeWidth="1.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 0.5 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.08, ease: EASE }}
            />
          ))}
        </svg>

        {/* track nodes (icon + label below) */}
        {TRACKS.map((t, i) => {
          const Icon = t.icon;
          return (
            <motion.div
              key={t.label}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${TRACK_X}%`, top: `${ROW_Y[i]}%` }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08, ease: EASE }}
            >
              <span className="relative flex h-9 w-9 items-center justify-center rounded-full border border-foreground/15 bg-secondary text-foreground/75">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                <span className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-foreground">
                  {t.label}
                </span>
              </span>
            </motion.div>
          );
        })}

        {/* Noon hub — convergence point */}
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${HUB.x}%`, top: `${HUB.y}%` }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.45, delay: 0.45, ease: EASE }}
        >
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" className="h-7 w-7" style={{ filter: "brightness(0) invert(1)" }} />
            <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 text-[11px] font-semibold text-foreground">
              Noon
            </span>
          </span>
        </motion.div>
      </div>

      <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground/70">
        One intake — routed to the right conversation.
      </p>
    </div>
  );
}
