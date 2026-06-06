"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Check } from "lucide-react";
import { EASE } from "@/lib/motion";
import { siteChromeDots } from "@/lib/site-tones";

// HumanReviewProof — the wedge rendered as a believable ARTIFACT (Cursor's
// annotated-PR pattern, adapted): AI drafts a change, a senior engineer reviews
// and approves it. This is the one thing a code generator cannot show. Window
// chrome + a compact diff + a reviewer approval. Hairline, mono for code,
// single accent + success token, reduced-motion-safe. No vendor names, generic
// (non-client) example.

const SUCCESS = "#2cc49a";
const REMOVED = "#e5484d";

export function HumanReviewProof() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="site-section">
      <div className="site-shell">
        <div ref={ref} className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* narrative */}
          <div>
            <span className="site-meta-label inline-flex items-center gap-3 font-mono text-muted-foreground">
              <span className="h-px w-8 bg-foreground/30" />
              The difference
            </span>
            <h2 className="site-section-title mt-4">Nothing ships without a human.</h2>
            <p className="site-section-copy mt-3 max-w-md text-muted-foreground">
              AI drafts fast — then a senior engineer reads every change, checks the edge cases,
              and signs off before it reaches your users. It&apos;s the part a code generator
              can&apos;t do.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                "Every change read and reviewed by a person",
                "Edge cases and tests verified, not assumed",
                "Approved by a senior engineer before it ships",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm leading-snug text-muted-foreground">
                  <span className="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${SUCCESS}1f` }}>
                    <Check className="h-2.5 w-2.5" style={{ color: SUCCESS }} strokeWidth={3} />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* artifact — review card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <div className="overflow-hidden rounded-[10px] border border-foreground/12 bg-card/40">
              {/* window chrome */}
              <div className="flex items-center gap-2 border-b border-foreground/10 px-4 py-2.5">
                <span className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: siteChromeDots.red }} />
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: siteChromeDots.amber }} />
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: siteChromeDots.green }} />
                </span>
                <span className="ml-1 font-mono text-[11px] text-muted-foreground/70">client-portal · review</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground/45">main</span>
              </div>

              {/* build summary (activity receipt) */}
              <div className="border-b border-foreground/10 px-4 py-2.5 font-mono text-[11px] text-muted-foreground/80">
                AI drafted the change · 9 files · 14 tests added
              </div>

              {/* diff */}
              <div className="px-4 py-3 font-mono text-[11.5px] leading-relaxed">
                <div className="mb-1 text-muted-foreground/55">checkout.ts</div>
                <div style={{ color: REMOVED }}>- if (amount &gt; 0) charge(amount)</div>
                <div style={{ color: SUCCESS }}>+ if (amount &gt; 0 &amp;&amp; isValidCurrency(cur)) charge(amount, cur)</div>
              </div>

              {/* reviewer approval */}
              <div className="flex items-start gap-3 border-t border-foreground/10 bg-foreground/[0.02] px-4 py-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-mono text-[11px] font-semibold text-primary">
                  SE
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[12px] font-semibold text-foreground">Senior engineer</span>
                    <span className="font-mono text-[11px] text-muted-foreground/60">· Noon</span>
                    <span
                      className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px]"
                      style={{ color: SUCCESS, backgroundColor: `${SUCCESS}14`, border: `1px solid ${SUCCESS}33` }}
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3} /> Approved
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                    Caught a missing currency check — added validation and a test. Verified the edge
                    cases. Approved to ship.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
