"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { Boxes, GitBranch, LifeBuoy, ScanSearch, TrendingUp, User } from "lucide-react";

// ============================================================================
// DecisionMap — Services decision diagram in the spirit of Vercel's "Secure
// Compute" (2026-06-01, v10): the header sits ABOVE the box, the client ("You")
// node sits to the LEFT outside the box with a dashed line entering it, and the
// 8px-radius framed box encloses ONLY the diagram core — the Noon hub fanning
// into the four service nodes. Curves + nodes share one coordinate space
// (SVG viewBox 0–100 + % positioning). Flat, single accent (#1200c5),
// theme-aware, motion always-on (owner preference), SSR-safe.
// ============================================================================

const EASE = [0.32, 0.72, 0, 1] as const;

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

// geometry INSIDE the box (% of the box's diagram area)
const HUB = { x: 9, y: 50 };
const NODE_X = 54;
const ROW_Y = [14, 38, 62, 86] as const;

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
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const play = inView;
  const services = paths.flatMap((p) => p.steps).slice(0, ROW_Y.length);

  return (
    <div ref={ref} className="mx-auto max-w-4xl">
      {/* OUTER square frame (0px radius) — wraps the whole section */}
      <div className="border border-foreground/15 bg-card/20 p-6 sm:p-8 lg:p-10">
      {/* header — inside the outer frame, outside the inner box */}
      {(eyebrow || title || subtitle) && (
        <motion.div
          className="mb-7 max-w-2xl"
          initial={{ opacity: 0, y: 10 }}
          animate={play ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
        >
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
        </motion.div>
      )}

      {/* client ("You") OUTSIDE + dashed line + the framed box */}
      <div className="relative">
        {/* You — outside the box, to the left */}
        <motion.div
          className="absolute left-[44px] top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 sm:block"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={play ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.45, delay: 0.05, ease: EASE }}
        >
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full border border-foreground/15 bg-secondary text-foreground/70">
            <User className="h-5 w-5" strokeWidth={1.75} />
            <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 text-[11px] font-medium text-muted-foreground">You</span>
          </span>
        </motion.div>

        {/* dashed connector: You → box edge */}
        <motion.div
          aria-hidden
          className="absolute top-1/2 z-0 hidden h-px -translate-y-1/2 border-t border-dashed border-foreground/30 sm:block"
          style={{ left: 66, width: 60 }}
          initial={{ opacity: 0 }}
          animate={play ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.15, ease: EASE }}
        />

        {/* THE BOX — encloses only Noon + branches + services (no left padding so
            the dashed line meets the hub) */}
        <div className="rounded-[8px] border border-foreground/20 bg-card/40 py-6 pl-0 pr-5 sm:ml-[126px] lg:py-7 lg:pr-8">
          <div className="relative h-[280px] w-full">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
              {/* dashed segment continuing from the box edge to the Noon hub */}
              <motion.line
                x1="0" y1={HUB.y} x2={HUB.x} y2={HUB.y}
                stroke="var(--color-foreground)" strokeOpacity="0.3" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke"
                initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : {}} transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
              />
              {/* one curve per service */}
              {services.map((s, i) => (
                <motion.path
                  key={s.name}
                  d={`M${HUB.x} ${HUB.y} C ${HUB.x + 14} ${HUB.y}, ${NODE_X - 10} ${ROW_Y[i]}, ${NODE_X} ${ROW_Y[i]}`}
                  stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                  initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : {}} transition={{ duration: 0.5, delay: 0.3 + i * 0.08, ease: EASE }}
                />
              ))}
            </svg>

            {/* Noon hub */}
            <motion.div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${HUB.x}%`, top: `${HUB.y}%` }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={play ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.45, delay: 0.25, ease: EASE }}
            >
              <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-icon.png" alt="" className="h-7 w-7" style={{ filter: "brightness(0) invert(1)" }} />
                <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 text-[11px] font-semibold text-foreground">Noon</span>
              </span>
            </motion.div>

            {/* service nodes */}
            {services.map((step, i) => {
              const Icon = ICONS[step.icon];
              return (
                <motion.div
                  key={step.name}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${NODE_X}%`, top: `${ROW_Y[i]}%` }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={play ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.1, ease: EASE }}
                >
                  <Link href={step.href} aria-label={`${step.name} — ${step.line}`} className="group relative block focus:outline-none">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/15 bg-secondary text-foreground/75 transition-all duration-200 group-hover:scale-105 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground group-focus-visible:border-primary group-focus-visible:ring-2 group-focus-visible:ring-primary/40">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className="absolute left-full top-1/2 ml-3 w-40 -translate-y-1/2 sm:w-48">
                      <span className="block text-[13px] font-semibold leading-tight tracking-[-0.01em] text-foreground">{step.name}</span>
                      {step.tagline && (
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">{step.tagline}</span>
                      )}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
