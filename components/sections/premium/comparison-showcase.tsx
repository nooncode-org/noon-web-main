"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

interface ComparisonItem {
  label: string;
  traditional: string;
  noon: string;
}

interface ComparisonShowcaseProps {
  title?: string;
  subtitle?: string;
  items: ComparisonItem[];
  className?: string;
}

export function ComparisonShowcase({
  title = "The Difference",
  subtitle,
  items,
  className = "",
}: ComparisonShowcaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isInView, items.length]);

  return (
    <section ref={containerRef} className={`relative py-24 overflow-hidden ${className}`}>
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(18, 0, 197, 0.5) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(18, 0, 197, 0.5) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-mono tracking-wide text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Why Noon
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              {subtitle}
            </p>
          )}
        </motion.div>

        {/* Comparison Grid */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Traditional Side */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-sm font-mono text-muted-foreground">
                01
              </span>
              <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Traditional Approach
              </span>
            </div>
            <div className="relative rounded-2xl border border-border/50 bg-muted/30 p-6 lg:p-8">
              {/* Terminal mockup */}
              <div className="rounded-lg border border-border/50 bg-background overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border/50 bg-muted/50 px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-400/80" />
                    <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
                    <span className="h-3 w-3 rounded-full bg-green-400/80" />
                  </div>
                  <span className="ml-2 text-xs font-mono text-muted-foreground">
                    traditional-process
                  </span>
                </div>
                <div className="p-4 font-mono text-sm">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-2"
                    >
                      <div className="text-muted-foreground">
                        <span className="text-red-400">$</span> {items[activeIndex].label}
                      </div>
                      <div className="pl-4 text-muted-foreground/70 leading-relaxed whitespace-pre-wrap">
                        {items[activeIndex].traditional}
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <span className="h-2 w-2 rounded-full bg-red-400/60 animate-pulse" />
                        <span className="text-xs text-red-400/80">Slow, manual process</span>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Noon Side */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-mono text-primary">
                02
              </span>
              <span className="text-sm font-medium uppercase tracking-wider text-primary">
                With Noon
              </span>
            </div>
            <div className="relative rounded-2xl border border-primary/20 bg-primary/5 p-6 lg:p-8">
              {/* Glow effect */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-primary/20 via-transparent to-primary/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
              
              {/* Terminal mockup */}
              <div className="relative rounded-lg border border-primary/20 bg-background overflow-hidden">
                <div className="flex items-center gap-2 border-b border-primary/10 bg-primary/5 px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-400/80" />
                    <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
                    <span className="h-3 w-3 rounded-full bg-green-400/80" />
                  </div>
                  <span className="ml-2 text-xs font-mono text-primary/80">
                    noon-pipeline
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-primary/60 bg-primary/10 px-2 py-0.5 rounded">
                    AI-POWERED
                  </span>
                </div>
                <div className="p-4 font-mono text-sm">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-2"
                    >
                      <div className="text-foreground">
                        <span className="text-primary">$</span> {items[activeIndex].label}
                      </div>
                      <div className="pl-4 text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {items[activeIndex].noon}
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-xs text-green-500">Automated, instant</span>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Progress indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 flex justify-center gap-2"
        >
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? "w-8 bg-primary"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
