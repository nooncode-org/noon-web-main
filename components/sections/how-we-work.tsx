"use client";

import { motion } from "framer-motion";
import { EASE } from "@/lib/motion";
import { useRevealMotion } from "@/hooks/use-reveal-motion";
import { Eyebrow } from "@/components/ui/eyebrow";

// HowWeWork — the process as Linear-style NUMBERED PILLARS (not a connector
// diagram; the decision-map already owns that language on /services). Four
// steps, with the "Human review" pillar visually emphasized because it's Noon's
// differentiator (AI speed + human judgment). Reuses the hairline gap-px grid
// the page already uses (ProblemAreas) so it reads native. Reveal-once with a
// small stagger via useRevealMotion (reduced-motion- and SSR-safe): the pillars
// show immediately for reduced-motion users, never gated behind a scroll.

const STEPS: { n: string; label: string; line: string; emphasis?: boolean }[] = [
  { n: "01", label: "Scope", line: "Maxwell scopes the real problem with you — before a line of code." },
  { n: "02", label: "Build", line: "Senior engineers own the build in a real, production codebase." },
  { n: "03", label: "Human review", line: "Every change is read and reviewed by a person before it ships.", emphasis: true },
  { n: "04", label: "Ship", line: "Working software your team operates — reviewed, and made to last." },
];

export function HowWeWork() {
  const { ref, show } = useRevealMotion({ margin: "-80px" });

  return (
    <section className="site-section">
      <div className="site-shell">
        <div ref={ref} className="mx-auto max-w-5xl">
          {/* header */}
          <div className="mb-10 max-w-2xl lg:mb-12">
            <Eyebrow>How we work</Eyebrow>
            <h2 className="site-section-title mt-4">
              AI speed. <span className="text-muted-foreground">Human judgment.</span>
            </h2>
            <p className="site-section-copy mt-3 text-muted-foreground">
              Every Noon build is AI-accelerated and owned by senior engineers — and nothing
              reaches your users until a person has reviewed it.
            </p>
          </div>

          {/* numbered pillars — hairline gap-px grid (matches ProblemAreas) */}
          <div className="overflow-hidden rounded-[12px] border border-foreground/12">
            <div className="grid gap-px bg-foreground/10 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.n}
                  className="relative flex flex-col bg-background p-6 lg:p-7"
                  initial={false}
                  animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                >
                  {/* accent top-edge marks the differentiating step */}
                  {step.emphasis && (
                    <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
                  )}
                  <span
                    className={`font-mono text-[13px] ${
                      step.emphasis ? "text-primary" : "text-muted-foreground/55"
                    }`}
                  >
                    {step.n}
                  </span>
                  <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                    {step.label}
                  </h3>
                  <p className="mt-2 text-sm leading-snug text-muted-foreground">{step.line}</p>
                  {step.emphasis && (
                    <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.06] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                      <span className="h-1 w-1 rounded-full bg-primary" />
                      The Noon difference
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
