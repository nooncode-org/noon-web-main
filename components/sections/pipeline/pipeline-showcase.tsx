"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { MessageSquare, Sparkles, Code2, CheckCircle } from "lucide-react";
import { PipelineNode } from "./pipeline-node";
import { AnimatedConnection } from "./animated-connection";
import { MockupBrief, MockupScope, MockupBuild, MockupProduct } from "./mockups";

// ============================================================================
// PipelineShowcase — Noon's real delivery methodology as a linear system flow.
//
// Honest narrative (need → scope w/ Maxwell → human review & build → working
// software), theme-aware, single-accent (#1200c5), square. NO hover/click/replay
// chrome — the only motion lives INSIDE each card and is contextual to that
// step: a typewriter brief, a "thinking" scope, a streamed review diff, and a
// drawing dashboard. Each card runs its own animation once when the section
// enters view, staggered left→right so the flow reads as a sequence. Fully
// static under prefers-reduced-motion. Each step carries an APPROVED brand
// principle (no invented metrics).
// ============================================================================

type StageKey = "need" | "scope" | "build" | "deliver";

const STAGES: {
  key: StageKey;
  label: string;
  sublabel: string;
  principle: string;
  icon: typeof MessageSquare;
}[] = [
  { key: "need", label: "Your need", sublabel: "In plain language", principle: "Tell us what you want to build", icon: MessageSquare },
  { key: "scope", label: "Scope with Maxwell", sublabel: "AI-accelerated", principle: "Scope before execution", icon: Sparkles },
  { key: "build", label: "Human review & build", sublabel: "Senior engineers", principle: "Judgment, not blind execution", icon: Code2 },
  { key: "deliver", label: "Working software", sublabel: "You operate it", principle: "Working software, not documentation", icon: CheckCircle },
];

const MOCKUPS = { need: MockupBrief, scope: MockupScope, build: MockupBuild, deliver: MockupProduct } as const;

// Left→right stagger so each card's contextual animation starts in flow order.
const START_DELAY = [0, 0.5, 1.0, 1.5];

export function PipelineShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  // once:false → the in-card animations re-play every time the section
  // scrolls into view (reliably observable), without an infinite loop.
  const isInView = useInView(containerRef, { margin: "-100px" });
  const reduceMotion = useReducedMotion();
  const play = isInView;

  const renderNode = (stage: (typeof STAGES)[number], i: number, fullWidth: boolean) => {
    const Mockup = MOCKUPS[stage.key];
    return (
      <PipelineNode
        label={stage.label}
        sublabel={stage.sublabel}
        principle={stage.principle}
        icon={<stage.icon className="h-3.5 w-3.5" />}
        delay={0.1 + i * 0.1}
        fullWidth={fullWidth}
      >
        <Mockup play={play} animate={!reduceMotion} startDelay={reduceMotion ? 0 : START_DELAY[i]} />
      </PipelineNode>
    );
  };

  return (
    <section ref={containerRef} className="site-section relative overflow-hidden">
      {/* Theme-aware grid backdrop (same --gl pattern as the page heroes) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [--gl:rgba(17,17,17,0.05)] dark:[--gl:rgba(255,255,255,0.05)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--gl) 1px, transparent 1px), linear-gradient(to bottom, var(--gl) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          backgroundPosition: "center",
          maskImage: "radial-gradient(ellipse 75% 70% at 50% 45%, #000 25%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 45%, #000 25%, transparent 85%)",
        }}
      />

      <div className="relative">
        {/* Header (within the standard shell) */}
        <div className="site-shell">
          <motion.div
            className="mx-auto mb-12 max-w-2xl text-center lg:mb-16"
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          >
            <span className="liquid-glass-pill mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              How it works
            </span>
            <h2 className="site-section-title mb-3">
              From problem to <span className="text-muted-foreground">working software.</span>
            </h2>
            <p className="site-section-copy mx-auto max-w-xl text-muted-foreground">
              Maxwell accelerates the definition, senior engineers own the judgment, and the
              result is real software you operate — not a prototype, not documentation.
            </p>
          </motion.div>
        </div>

        {/* Flow — wider container than the shell so the cards can breathe */}
        <div className="mx-auto w-full max-w-[1480px] px-4">
          {/* desktop (horizontal) */}
          <div className="hidden items-stretch justify-center gap-0 lg:flex">
            {STAGES.map((stage, i) => (
              <div key={stage.key} className="flex items-stretch">
                {renderNode(stage, i, false)}
                {i < STAGES.length - 1 && (
                  <div className="flex w-10 items-center">
                    <AnimatedConnection active={play} animate={!reduceMotion} delay={0.3 + i * 0.5} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* mobile / tablet (vertical) */}
          <div className="flex flex-col items-center gap-0 lg:hidden">
            {STAGES.map((stage, i) => (
              <div key={stage.key} className="flex w-full max-w-sm flex-col items-stretch">
                {renderNode(stage, i, true)}
                {i < STAGES.length - 1 && (
                  <div className="flex h-10 justify-center">
                    <AnimatedConnection direction="vertical" active={play} animate={!reduceMotion} delay={0.3 + i * 0.5} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
