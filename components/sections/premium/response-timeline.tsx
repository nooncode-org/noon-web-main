"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Clock, Zap, Shield, Users } from "lucide-react";

interface TimelineStep {
  time: string;
  title: string;
  description: string;
  status?: "pending" | "active" | "complete";
}

interface ResponseTimelineProps {
  title?: string;
  subtitle?: string;
  steps: TimelineStep[];
  className?: string;
}

export function ResponseTimeline({
  title = "What to Expect",
  subtitle,
  steps,
  className = "",
}: ResponseTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isInView, steps.length]);

  return (
    <section ref={containerRef} className={`relative py-24 overflow-hidden ${className}`}>
      {/* Ambient gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
      
      <div className="relative mx-auto max-w-5xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-mono tracking-wide text-primary">
            <Shield className="h-3 w-3" />
            Our Commitment
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              {subtitle}
            </p>
          )}
        </motion.div>

        {/* Timeline visualization */}
        <div className="relative">
          {/* Connection line */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent hidden md:block" />
          
          {/* Mobile: horizontal line */}
          <div className="absolute top-8 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent md:hidden" />

          <div className="space-y-6 md:space-y-0 md:grid md:gap-8">
            {steps.map((step, index) => {
              const isActive = index === activeStep;
              const isComplete = index < activeStep;
              const StatusIcon = isComplete ? Check : isActive ? Zap : Clock;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  onClick={() => setActiveStep(index)}
                  className={`relative flex items-start gap-6 p-6 rounded-2xl cursor-pointer transition-all duration-500 ${
                    isActive
                      ? "bg-primary/5 border border-primary/20"
                      : "hover:bg-muted/30"
                  }`}
                >
                  {/* Time indicator */}
                  <div className="flex flex-col items-center">
                    <motion.div
                      animate={{
                        scale: isActive ? 1.1 : 1,
                        backgroundColor: isActive
                          ? "rgb(18, 0, 197)"
                          : isComplete
                          ? "rgb(34, 197, 94)"
                          : "transparent",
                        borderColor: isActive
                          ? "rgb(18, 0, 197)"
                          : isComplete
                          ? "rgb(34, 197, 94)"
                          : "rgb(229, 231, 235)",
                      }}
                      transition={{ duration: 0.3 }}
                      className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border-2 ${
                        isActive || isComplete ? "text-white" : "text-muted-foreground bg-background"
                      }`}
                    >
                      <StatusIcon className="h-6 w-6" />
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 rounded-2xl bg-primary"
                          animate={{ opacity: [0.5, 0.2, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          style={{ filter: "blur(8px)", zIndex: -1 }}
                        />
                      )}
                    </motion.div>
                    <span className={`mt-2 text-sm font-mono ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {step.time}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-2">
                    <h3 className={`text-lg font-semibold transition-colors ${
                      isActive ? "text-foreground" : "text-foreground/80"
                    }`}>
                      {step.title}
                    </h3>
                    <AnimatePresence mode="wait">
                      {isActive && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mt-2 text-muted-foreground leading-relaxed"
                        >
                          {step.description}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Arrow indicator */}
                  <motion.div
                    animate={{ x: isActive ? 4 : 0, opacity: isActive ? 1 : 0.3 }}
                    className="self-center"
                  >
                    <ArrowRight className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Bottom stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 grid grid-cols-3 gap-4 rounded-2xl border border-border/50 bg-muted/20 p-6"
        >
          {[
            { icon: Clock, value: "< 2hrs", label: "First Response" },
            { icon: Users, value: "24/7", label: "Support Available" },
            { icon: Shield, value: "100%", label: "Response Rate" },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <stat.icon className="mx-auto h-5 w-5 text-primary mb-2" />
              <div className="text-xl font-semibold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
