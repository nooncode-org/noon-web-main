"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Gauge, 
  Eye, 
  Smartphone, 
  Zap,
  ArrowRight,
  TrendingUp
} from "lucide-react";

interface ScanMetric {
  label: string;
  before: number;
  after: number;
  unit: string;
  icon: typeof Gauge;
  improvement: string;
}

interface BeforeAfterScanProps {
  className?: string;
}

const scanMetrics: ScanMetric[] = [
  {
    label: "Performance",
    before: 45,
    after: 94,
    unit: "",
    icon: Gauge,
    improvement: "+49 pts",
  },
  {
    label: "Accessibility",
    before: 62,
    after: 98,
    unit: "",
    icon: Eye,
    improvement: "+36 pts",
  },
  {
    label: "Mobile Score",
    before: 38,
    after: 96,
    unit: "",
    icon: Smartphone,
    improvement: "+58 pts",
  },
  {
    label: "Load Time",
    before: 4.2,
    after: 0.8,
    unit: "s",
    icon: Zap,
    improvement: "-81%",
  },
];

const issues = [
  { type: "critical", count: 12, label: "Critical issues" },
  { type: "warning", count: 23, label: "Warnings" },
  { type: "info", count: 8, label: "Suggestions" },
];

export function BeforeAfterScan({ className = "" }: BeforeAfterScanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  const [showAfter, setShowAfter] = useState(false);
  const [animatedMetrics, setAnimatedMetrics] = useState(scanMetrics.map(m => ({ ...m, current: m.before })));

  useEffect(() => {
    if (!isInView) return;
    
    const timer = setTimeout(() => {
      setShowAfter(true);
      
      // Animate metrics
      scanMetrics.forEach((metric, index) => {
        const steps = 30;
        const increment = (metric.after - metric.before) / steps;
        let step = 0;
        
        const interval = setInterval(() => {
          step++;
          setAnimatedMetrics(prev => 
            prev.map((m, i) => 
              i === index 
                ? { ...m, current: Math.round((m.before + increment * step) * 10) / 10 }
                : m
            )
          );
          if (step >= steps) clearInterval(interval);
        }, 30);
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [isInView]);

  return (
    <section ref={containerRef} className={`relative py-24 overflow-hidden ${className}`}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-transparent to-muted/30" />
      
      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-mono tracking-wide text-primary">
            <TrendingUp className="h-3 w-3" />
            Real Results
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            See the transformation
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Maxwell analyzes your site and generates a fully upgraded version with all improvements applied.
          </p>
        </motion.div>

        {/* Before/After visualization */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Before */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-sm font-mono text-red-500">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium uppercase tracking-wider text-red-500">
                Before Upgrade
              </span>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
              {/* Scan results mockup */}
              <div className="rounded-xl border border-border/50 bg-background overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-400" />
                    <span className="h-3 w-3 rounded-full bg-yellow-400/50" />
                    <span className="h-3 w-3 rounded-full bg-green-400/50" />
                  </div>
                  <span className="ml-2 text-xs font-mono text-muted-foreground">
                    scan-results.before
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {/* Issues summary */}
                  <div className="flex gap-4">
                    {issues.map((issue) => (
                      <div
                        key={issue.type}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                          issue.type === "critical"
                            ? "bg-red-500/10 text-red-500"
                            : issue.type === "warning"
                            ? "bg-yellow-500/10 text-yellow-600"
                            : "bg-blue-500/10 text-blue-500"
                        }`}
                      >
                        <span className="font-mono font-bold">{issue.count}</span>
                        <span className="text-xs">{issue.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Metrics */}
                  <div className="space-y-3">
                    {scanMetrics.map((metric) => (
                      <div key={metric.label} className="flex items-center gap-3">
                        <metric.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground w-24">{metric.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={isInView ? { width: `${metric.before}%` } : {}}
                            transition={{ duration: 1, delay: 0.5 }}
                            className="h-full bg-red-400/60 rounded-full"
                          />
                        </div>
                        <span className="text-sm font-mono text-red-400 w-12 text-right">
                          {metric.before}{metric.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* After */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-sm font-mono text-green-500">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium uppercase tracking-wider text-green-500">
                After Upgrade
              </span>
            </div>

            <div className={`rounded-2xl border p-6 transition-all duration-500 ${
              showAfter 
                ? "border-green-500/20 bg-green-500/5" 
                : "border-border/50 bg-muted/20"
            }`}>
              <div className="rounded-xl border border-border/50 bg-background overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className={`h-3 w-3 rounded-full transition-colors duration-500 ${showAfter ? "bg-green-400" : "bg-muted"}`} />
                    <span className={`h-3 w-3 rounded-full transition-colors duration-500 ${showAfter ? "bg-green-400" : "bg-muted"}`} />
                    <span className={`h-3 w-3 rounded-full transition-colors duration-500 ${showAfter ? "bg-green-400" : "bg-muted"}`} />
                  </div>
                  <span className="ml-2 text-xs font-mono text-muted-foreground">
                    scan-results.after
                  </span>
                  {showAfter && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="ml-auto text-[10px] font-mono text-green-500 bg-green-500/10 px-2 py-0.5 rounded"
                    >
                      ALL PASSED
                    </motion.span>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {/* Issues resolved */}
                  <AnimatePresence mode="wait">
                    {showAfter ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-500"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>All {issues.reduce((a, b) => a + b.count, 0)} issues resolved</span>
                      </motion.div>
                    ) : (
                      <div className="flex gap-4">
                        <div className="h-8 w-32 rounded-lg bg-muted animate-pulse" />
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Metrics animated */}
                  <div className="space-y-3">
                    {animatedMetrics.map((metric, index) => (
                      <div key={metric.label} className="flex items-center gap-3">
                        <metric.icon className={`h-4 w-4 transition-colors duration-500 ${
                          showAfter ? "text-green-500" : "text-muted-foreground"
                        }`} />
                        <span className="text-sm text-muted-foreground w-24">{metric.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            animate={{ width: `${showAfter ? metric.current : 0}%` }}
                            transition={{ duration: 0.5 }}
                            className={`h-full rounded-full transition-colors duration-500 ${
                              showAfter ? "bg-green-400" : "bg-muted-foreground/30"
                            }`}
                          />
                        </div>
                        <span className={`text-sm font-mono w-12 text-right transition-colors duration-500 ${
                          showAfter ? "text-green-500" : "text-muted-foreground"
                        }`}>
                          {showAfter ? `${metric.current}${metric.unit}` : "—"}
                        </span>
                        {showAfter && (
                          <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="text-xs font-mono text-green-500"
                          >
                            {metric.improvement}
                          </motion.span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Arrow indicator */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex items-center justify-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <ArrowRight className="h-5 w-5" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
