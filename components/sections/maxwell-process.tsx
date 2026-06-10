"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { EASE } from "@/lib/motion";
import { useRevealMotion } from "@/hooks/use-reveal-motion";
import { Eyebrow } from "@/components/ui/eyebrow";
import { siteStatusTones } from "@/lib/site-tones";

// MaxwellProcess — the CLIENT's journey through Maxwell as a stage rail, with
// the human review rendered as an explicit GATE the flow stops at (audit P7,
// "the trust moment"). Content is governed by the owner's six framing decisions
// (2026-06-10, specs/2026-06-10-maxwell-process-explainer.md): tools stay
// abstract ("AI", no vendors), the 2-correction limit reads as "2 rounds of
// feedback included" (the only loop, bounded), reviewers are role-specific (PM
// for the proposal, senior engineer for code), turnaround stays qualitative
// (no clock promises), and the payment line is marked — the build stage is
// labeled "after activation" so pre-pay visuals never imply delivery.

const SUCCESS = siteStatusTones.success.accent;

type Stage = {
  n: string;
  title: string;
  line: string;
  gate?: boolean; // renders the review-gate artifact
  meter?: boolean; // renders the bounded feedback-rounds meter
  divider?: boolean; // renders the "project activation" line above the row
  badge?: string;
};

const STAGES: Stage[] = [
  {
    n: "01",
    title: "Share your idea",
    line: "Describe what you want to build, in plain language. Maxwell asks until the goal — and the problem behind it — is clear.",
  },
  {
    n: "02",
    title: "Get a working direction",
    line: "The AI shapes your brief into a scoped direction with a clickable prototype — something you can react to, not a slide.",
  },
  {
    n: "03",
    title: "Refine it",
    line: "You react, Maxwell adjusts — until the direction is yours.",
    meter: true,
  },
  {
    n: "04",
    title: "A person reviews before you see it",
    line: "The AI drafts your proposal — and a PM reads, corrects, and approves it before it reaches you.",
    gate: true,
  },
  {
    n: "05",
    title: "Approve & activate",
    line: "Scope, deliverables, timeline, and investment — in plain terms. The project activates on payment.",
  },
  {
    n: "06",
    title: "Build, review, deliver",
    line: "Senior engineers build on the approved scope — and every change is signed off by a senior engineer before it ships.",
    divider: true,
    badge: "after activation",
  },
];

function RoundsMeter() {
  return (
    <div className="mt-3 inline-flex items-center gap-2.5 rounded-full border border-foreground/10 bg-background px-3 py-1.5">
      <span className="flex gap-1" aria-hidden>
        <span className="h-1.5 w-5 rounded-full bg-primary/70" />
        <span className="h-1.5 w-5 rounded-full bg-primary/70" />
      </span>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
        2 rounds of feedback included
      </span>
    </div>
  );
}

function LaneChip({
  icon: Icon,
  text,
  sub,
}: {
  icon: typeof Sparkles;
  text: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] border border-foreground/10 bg-background px-3 py-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium leading-snug text-foreground">{text}</div>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">{sub}</div>
      </div>
    </div>
  );
}

// Two lanes (AI draft / PM review) converge into the gate, then flow to "your
// proposal". Fixed-geometry elbows (static SVG) — deliberately NOT measured-DOM
// connectors; this diagram never reflows internally.
function ReviewGate() {
  return (
    <div className="mt-4 rounded-[12px] border border-primary/25 bg-card/30 p-4 lg:p-5">
      <div className="flex flex-col items-stretch gap-3 md:grid md:grid-cols-[minmax(0,1.15fr)_auto_auto_auto_minmax(0,0.85fr)] md:items-center md:gap-0">
        {/* the two converging lanes */}
        <div className="flex flex-col gap-2.5">
          <LaneChip icon={Sparkles} text="Maxwell drafts it" sub="scope · timeline · investment" />
          <LaneChip icon={UserRound} text="A PM reads it" sub="corrects · challenges · verifies" />
        </div>

        {/* converging elbows (desktop) / vertical hairline (stacked) */}
        <svg
          aria-hidden
          viewBox="0 0 44 96"
          className="hidden h-24 w-11 text-foreground/25 md:block"
          fill="none"
        >
          <path d="M0 26 H14 Q22 26 22 34 V40 Q22 48 30 48 H44" stroke="currentColor" strokeWidth="1" />
          <path d="M0 70 H14 Q22 70 22 62 V56 Q22 48 30 48 H44" stroke="currentColor" strokeWidth="1" />
        </svg>
        <span aria-hidden className="mx-auto h-4 w-px bg-foreground/20 md:hidden" />

        {/* the gate */}
        <div className="flex flex-col items-center gap-1 rounded-[10px] border border-primary/30 bg-primary/[0.05] px-4 py-3 text-center">
          <ShieldCheck className="h-[18px] w-[18px] text-primary" strokeWidth={1.75} />
          <span className="text-[12.5px] font-semibold text-foreground">Human sign-off</span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground/70">
            every proposal · no exceptions
          </span>
        </div>

        {/* out to the client */}
        <span aria-hidden className="mx-auto h-4 w-px bg-foreground/20 md:hidden" />
        <span aria-hidden className="hidden items-center px-1.5 md:flex">
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.75} />
        </span>
        <div className="rounded-[10px] border border-foreground/10 bg-background px-3.5 py-2.5">
          <div className="text-[12.5px] font-medium text-foreground">Your proposal</div>
          <span
            className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9.5px]"
            style={{ color: SUCCESS, backgroundColor: `${SUCCESS}14`, border: `1px solid ${SUCCESS}33` }}
          >
            <Check className="h-2.5 w-2.5" strokeWidth={3} /> Approved
          </span>
        </div>
      </div>
    </div>
  );
}

export function MaxwellProcess() {
  const { ref, show } = useRevealMotion({ margin: "-80px" });

  return (
    <section className="site-section">
      <div className="site-shell">
        <div ref={ref} className="mx-auto max-w-3xl">
          <div className="max-w-2xl">
            <Eyebrow>The process</Eyebrow>
            <h2 className="site-section-title mt-4">What happens after you hit send.</h2>
            <p className="site-section-copy mt-3 text-muted-foreground">
              Maxwell turns your first message into a scoped, human-checked project — a working
              prototype to react to, a proposal a person signed off, and a clear line where the
              build begins.
            </p>
          </div>

          <ol className="relative mt-10 lg:mt-12">
            {/* hairline rail behind the stage nodes */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-3 left-[17px] top-3 w-px bg-foreground/12"
            />
            {STAGES.map((s, i) => (
              <motion.li
                key={s.n}
                className="pb-9 last:pb-0"
                initial={false}
                animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{ duration: 0.45, delay: i * 0.07, ease: EASE }}
              >
                {/* the payment line — everything below happens post-activation */}
                {s.divider && (
                  <div className="mb-8 flex items-center gap-3" role="presentation">
                    <span className="h-px flex-1 bg-foreground/12" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                      project activation
                    </span>
                    <span className="h-px flex-1 bg-foreground/12" />
                  </div>
                )}
                <div className="flex gap-5">
                  <span
                    className={`relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background ${
                      s.gate ? "border-primary/40" : "border-foreground/15"
                    }`}
                  >
                    {s.gate ? (
                      <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={1.75} />
                    ) : (
                      <span className="font-mono text-[11px] text-muted-foreground">{s.n}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                        {s.title}
                      </h3>
                      {s.badge && (
                        <span className="rounded-full border border-foreground/12 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground/70">
                          {s.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.line}</p>
                    {s.meter && <RoundsMeter />}
                    {s.gate && <ReviewGate />}
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
