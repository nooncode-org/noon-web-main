"use client";

/**
 * UpgradeSteps — the "Scan / Diagnose / Generate" process cards on /upgrade.
 *
 * Extracted from the (server) page into a client component so the cards
 * reveal ON SCROLL-INTO-VIEW instead of on page load. The previous CSS
 * `reveal-up` animation fired at load, so when the block sits below the fold
 * the user never saw it move. SSR-safe via useHasMounted (server + first
 * client paint render the final visible state — no hydration mismatch), and
 * it respects prefers-reduced-motion.
 */

import { motion } from "framer-motion";
import { Activity, ScanSearch, Sparkles, type LucideIcon } from "lucide-react";
import { EASE } from "@/lib/motion";
import { useRevealMotion } from "@/hooks/use-reveal-motion";

const STEPS: { step: string; title: string; description: string; Icon: LucideIcon }[] = [
  {
    step: "01",
    title: "Scan",
    description:
      "We analyze your live website for performance, accessibility, UI/UX issues, and conversion opportunities.",
    Icon: ScanSearch,
  },
  {
    step: "02",
    title: "Diagnose",
    description:
      "Maxwell identifies specific improvements with detailed recommendations and priority rankings.",
    Icon: Activity,
  },
  {
    step: "03",
    title: "Generate",
    description:
      "Get a fully upgraded version of your site with all improvements applied, ready for review.",
    Icon: Sparkles,
  },
];

export function UpgradeSteps() {
  // Reveal once on scroll-into-view; SSR-safe (see useRevealMotion).
  const { ref, show } = useRevealMotion({ margin: "-80px" });

  return (
    <div ref={ref} className="grid gap-6 md:grid-cols-3">
      {STEPS.map((item, index) => (
        <motion.div
          key={item.step}
          className="group border border-foreground/10 bg-card/50 p-6 transition-colors duration-300 hover:border-foreground/20"
          initial={false}
          animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, delay: 0.1 + index * 0.12, ease: EASE }}
        >
          <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-[8px] border border-primary/30 bg-primary/10 text-primary">
            <item.Icon className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground/50">{item.step}</span>
            <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        </motion.div>
      ))}
    </div>
  );
}
