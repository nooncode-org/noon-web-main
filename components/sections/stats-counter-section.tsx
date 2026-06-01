"use client";

import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { type LucideIcon } from "lucide-react";

type Stat = {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
};

type StatsCounterSectionProps = {
  title?: string;
  subtitle?: string;
  stats: Stat[];
  className?: string;
  variant?: "grid" | "inline" | "cards";
  columns?: 2 | 3 | 4;
};

export function StatsCounterSection({
  title,
  subtitle,
  stats,
  className = "",
  variant = "grid",
  columns = 4,
}: StatsCounterSectionProps) {
  const { ref, isVisible } = useRevealOnView<HTMLElement>({
    threshold: 0.1,
    once: true,
  });

  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
  };

  if (variant === "inline") {
    return (
      <section ref={ref} className={`site-section ${className}`}>
        <div className="site-shell">
          <div
            className="flex flex-wrap items-center justify-center gap-8 lg:gap-16"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="text-center"
                style={{
                  transitionDelay: `${index * 100}ms`,
                }}
              >
                <div className="mb-1 text-3xl font-bold text-foreground lg:text-4xl">
                  <AnimatedCounter
                    end={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    delay={index * 150}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (variant === "cards") {
    return (
      <section ref={ref} className={`site-section ${className}`}>
        <div className="site-shell">
          {/* Header */}
          {(title || subtitle) && (
            <div
              className="mb-12 text-center transition-all duration-700"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(20px)",
              }}
            >
              {subtitle && (
                <p className="site-meta-label mb-3 text-muted-foreground">
                  {subtitle}
                </p>
              )}
              {title && (
                <h2 className="site-section-title text-foreground">{title}</h2>
              )}
            </div>
          )}

          {/* Stats Cards */}
          <div className={`grid gap-6 ${gridCols[columns]}`}>
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-6 transition-all duration-500 hover:border-primary/20 hover:bg-card hover:shadow-lg hover:shadow-primary/5"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(30px)",
                    transition: `all 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${index * 100}ms`,
                  }}
                >
                  {/* Icon */}
                  {Icon && (
                    <div className="mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                  )}

                  {/* Value */}
                  <div className="mb-2 text-3xl font-bold text-foreground lg:text-4xl">
                    <AnimatedCounter
                      end={stat.value}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                      delay={200 + index * 100}
                    />
                  </div>

                  {/* Label */}
                  <p className="text-sm font-medium text-foreground">
                    {stat.label}
                  </p>

                  {/* Description */}
                  {stat.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                  )}

                  {/* Hover glow */}
                  <div
                    className="pointer-events-none absolute -inset-4 rounded-3xl bg-primary/5 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // Default grid variant
  return (
    <section ref={ref} className={`site-section ${className}`}>
      <div className="site-shell">
        {/* Header */}
        {(title || subtitle) && (
          <div
            className="mb-12 text-center transition-all duration-700"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(20px)",
            }}
          >
            {subtitle && (
              <p className="site-meta-label mb-3 text-muted-foreground">
                {subtitle}
              </p>
            )}
            {title && (
              <h2 className="site-section-title text-foreground">{title}</h2>
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div
          className={`grid gap-8 rounded-2xl border border-border/50 bg-card/30 p-8 ${gridCols[columns]}`}
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.2s",
          }}
        >
          {stats.map((stat, index) => (
            <div key={stat.label} className="text-center">
              <div className="mb-2 text-4xl font-bold text-foreground lg:text-5xl">
                <AnimatedCounter
                  end={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  delay={300 + index * 100}
                />
              </div>
              <p className="text-sm font-medium text-foreground">{stat.label}</p>
              {stat.description && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
