"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { EASE } from "@/lib/motion";
import { MaskLogo } from "@/components/ui/mask-logo";
import { useRevealMotion } from "@/hooks/use-reveal-motion";

// StackAuthority — honest "built-on" authority play + the human-review wedge, in
// one band. The credibility is a CAPABILITY claim (Noon builds on these tools),
// never an endorsement (these companies do NOT vouch for Noon). The wedge —
// "every build human-reviewed" — is the one thing a code generator can't claim.
// Monochrome logos (reuse MaskLogo), hairline, single accent, reduced-motion-safe.

const STACK = [
  { src: "/figma/logos/logo-anthropic.svg", alt: "Anthropic" },
  { src: "/figma/logos/logo-openai.svg", alt: "OpenAI" },
  { src: "/figma/logos/logo-vercel.svg", alt: "Vercel" },
  { src: "/figma/logos/logo-stripe.svg", alt: "Stripe" },
  { src: "/figma/logos/logo-supabase.svg", alt: "Supabase" },
];

export function StackAuthority() {
  const { ref, show } = useRevealMotion({ margin: "-80px" });

  return (
    <section className="py-12 lg:py-16">
      <div className="site-shell">
        <div
          ref={ref}
          className="mx-auto grid max-w-4xl overflow-hidden rounded-[12px] border border-foreground/12 md:grid-cols-[1.4fr_1fr]"
        >
          {/* Built-on a frontier stack (capability claim) */}
          <div className="border-b border-foreground/10 p-6 md:border-b-0 md:border-r lg:p-8">
            <span className="site-meta-label inline-flex items-center gap-3 font-mono text-muted-foreground">
              <span className="h-px w-8 bg-foreground/30" />
              The stack
            </span>
            <h2 className="site-section-title mt-4">Built on a frontier stack.</h2>
            <p className="site-section-copy mt-3 max-w-md text-muted-foreground">
              The same Anthropic, OpenAI, Vercel, Stripe, and Supabase that power today&apos;s best
              software — so what we ship inherits their security, scale, and reliability.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-4">
              {STACK.map((l, i) => (
                <motion.span
                  key={l.alt}
                  className="inline-flex items-center gap-2"
                  initial={false}
                  animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.06, ease: EASE }}
                >
                  <MaskLogo src={l.src} alt={l.alt} className="h-4 w-4 opacity-55" />
                  <span className="text-[12px] text-muted-foreground">{l.alt}</span>
                </motion.span>
              ))}
            </div>
          </div>

          {/* The human-review wedge */}
          <div className="flex flex-col justify-center bg-primary/[0.04] p-6 lg:p-8">
            <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-primary/30 bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <p className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              Every build, human-reviewed.
            </p>
            <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
              AI accelerates the work — a senior engineer reviews every change before it ships. The
              one thing a code generator can&apos;t give you.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
