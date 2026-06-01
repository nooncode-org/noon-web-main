"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Sparkles, Code, Layers, Palette, Database, Lock, ArrowRight } from "lucide-react";

interface TemplateFeature {
  icon: typeof Code;
  label: string;
}

interface TemplatePreviewProps {
  className?: string;
}

const features: TemplateFeature[] = [
  { icon: Code, label: "Production Code" },
  { icon: Database, label: "Database Ready" },
  { icon: Lock, label: "Auth Included" },
  { icon: Palette, label: "Customizable" },
  { icon: Layers, label: "Scalable" },
];

const mockScreens = [
  {
    title: "Dashboard",
    description: "Analytics & metrics",
    gradient: "from-blue-500/20 to-purple-500/20",
  },
  {
    title: "User Management",
    description: "Roles & permissions",
    gradient: "from-green-500/20 to-teal-500/20",
  },
  {
    title: "Settings",
    description: "Configuration panel",
    gradient: "from-orange-500/20 to-red-500/20",
  },
];

export function TemplateHeroPreview({ className = "" }: TemplatePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-50px" });
  const [activeScreen, setActiveScreen] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      setActiveScreen((prev) => (prev + 1) % mockScreens.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isInView]);

  return (
    <section ref={containerRef} className={`relative py-16 overflow-hidden ${className}`}>
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left: Text content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-mono tracking-wide text-primary">
              <Sparkles className="h-3 w-3" />
              Production-Ready
            </span>
            
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl lg:text-5xl">
              Start with a{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                solid foundation
              </span>
            </h2>
            
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Every template is a complete, production-ready codebase. Not wireframes, 
              not mockups — real software you can deploy and customize.
            </p>

            {/* Features */}
            <div className="mt-8 flex flex-wrap gap-3">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1.5 text-sm text-muted-foreground"
                >
                  <feature.icon className="h-3.5 w-3.5 text-primary" />
                  {feature.label}
                </motion.div>
              ))}
            </div>

            {/* CTA hint */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mt-8 flex items-center gap-2 text-sm text-primary"
            >
              <span>Browse templates below</span>
              <ArrowRight className="h-4 w-4 animate-pulse" />
            </motion.div>
          </motion.div>

          {/* Right: Visual mockup */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Browser frame */}
            <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-2xl">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-400/80" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <span className="h-3 w-3 rounded-full bg-green-400/80" />
                </div>
                <div className="ml-4 flex-1 rounded-md bg-background/50 px-3 py-1 text-xs text-muted-foreground font-mono">
                  app.yourcompany.com
                </div>
              </div>

              {/* Screen content */}
              <div className="relative h-80 bg-gradient-to-br from-background to-muted/30">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeScreen}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 p-6"
                  >
                    {/* Sidebar mockup */}
                    <div className="absolute left-0 top-0 bottom-0 w-16 border-r border-border/30 bg-muted/20">
                      <div className="p-3 space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`h-8 w-8 rounded-lg ${
                              i === activeScreen
                                ? "bg-primary/30"
                                : "bg-muted-foreground/10"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Main content area */}
                    <div className="ml-20">
                      <div className="mb-4">
                        <div className="h-6 w-32 rounded bg-foreground/10 mb-2" />
                        <div className="h-4 w-48 rounded bg-muted-foreground/10" />
                      </div>

                      {/* Cards grid */}
                      <div className="grid grid-cols-3 gap-3">
                        {[...Array(6)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.05 }}
                            className={`h-20 rounded-lg bg-gradient-to-br ${mockScreens[activeScreen].gradient} border border-border/20`}
                          >
                            <div className="p-3">
                              <div className="h-2 w-12 rounded bg-foreground/20 mb-2" />
                              <div className="h-6 w-full rounded bg-foreground/10" />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Floating label */}
                <div className="absolute bottom-4 right-4">
                  <motion.div
                    key={activeScreen}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg bg-background/90 backdrop-blur-sm border border-border/50 px-3 py-2 shadow-lg"
                  >
                    <div className="text-xs font-medium text-foreground">
                      {mockScreens[activeScreen].title}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {mockScreens[activeScreen].description}
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-radial from-primary/10 via-transparent to-transparent opacity-50 blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
