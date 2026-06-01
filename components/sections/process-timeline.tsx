"use client";

import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import { Check, type LucideIcon } from "lucide-react";

type ProcessStep = {
  number: string;
  title: string;
  description: string;
  icon?: LucideIcon;
};

type ProcessTimelineProps = {
  title?: string;
  subtitle?: string;
  steps: ProcessStep[];
  className?: string;
  variant?: "horizontal" | "vertical";
};

export function ProcessTimeline({
  title = "How We Work",
  subtitle = "Our streamlined process",
  steps,
  className = "",
  variant = "horizontal",
}: ProcessTimelineProps) {
  const { ref, isVisible } = useRevealOnView<HTMLElement>({
    threshold: 0.1,
    once: true,
  });

  if (variant === "vertical") {
    return (
      <section ref={ref} className={`site-section ${className}`}>
        <div className="site-shell">
          {/* Header */}
          <div
            className="mb-12 text-center transition-all duration-700"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(20px)",
            }}
          >
            <p className="site-meta-label mb-3 text-muted-foreground">{subtitle}</p>
            <h2 className="site-section-title text-foreground">{title}</h2>
          </div>

          {/* Vertical Timeline */}
          <div className="relative mx-auto max-w-2xl">
            {/* Connecting line */}
            <div
              className="absolute left-6 top-0 h-full w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent transition-all duration-1000 lg:left-1/2 lg:-translate-x-1/2"
              style={{
                transform: isVisible ? "scaleY(1)" : "scaleY(0)",
                transformOrigin: "top",
              }}
              aria-hidden="true"
            />

            {/* Steps */}
            <div className="space-y-8">
              {steps.map((step, index) => {
                const Icon = step.icon || Check;
                return (
                  <div
                    key={step.number}
                    className="relative flex gap-6 lg:gap-12"
                    style={{
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                      transition: `all 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${300 + index * 150}ms`,
                    }}
                  >
                    {/* Step indicator */}
                    <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-primary/20">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-8">
                      <span className="site-meta-label text-primary">
                        Step {step.number}
                      </span>
                      <h3 className="mb-2 mt-1 text-lg font-semibold text-foreground">
                        {step.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Horizontal variant
  return (
    <section ref={ref} className={`site-section ${className}`}>
      <div className="site-shell">
        {/* Header */}
        <div
          className="mb-12 text-center transition-all duration-700"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <p className="site-meta-label mb-3 text-muted-foreground">{subtitle}</p>
          <h2 className="site-section-title text-foreground">{title}</h2>
        </div>

        {/* Horizontal Timeline */}
        <div className="relative">
          {/* Connecting line */}
          <div
            className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent md:block"
            style={{
              transform: isVisible ? "scaleX(1)" : "scaleX(0)",
              transition: "transform 1s cubic-bezier(0.22, 1, 0.36, 1) 0.3s",
            }}
            aria-hidden="true"
          />

          {/* Steps */}
          <div className="grid gap-8 md:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon || Check;
              return (
                <div
                  key={step.number}
                  className="group relative text-center"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(30px)",
                    transition: `all 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${200 + index * 100}ms`,
                  }}
                >
                  {/* Step indicator */}
                  <div className="relative mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary bg-background transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20">
                    <Icon className="h-5 w-5 text-primary" />
                    {/* Pulse effect */}
                    <div
                      className="absolute inset-0 rounded-full bg-primary/20 opacity-0 transition-opacity duration-300 group-hover:animate-ping group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </div>

                  {/* Content */}
                  <span className="site-meta-label text-primary">
                    Step {step.number}
                  </span>
                  <h3 className="mb-2 mt-1 text-base font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
