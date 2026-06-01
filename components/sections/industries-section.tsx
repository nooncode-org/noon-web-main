"use client";

import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import {
  Monitor,
  HeartPulse,
  TrendingUp,
  ShoppingBag,
  GraduationCap,
  Factory,
  Building2,
  Plane,
  Utensils,
  Gamepad2,
  type LucideIcon,
} from "lucide-react";

type Industry = {
  icon: LucideIcon;
  name: string;
  description: string;
};

const industries: Industry[] = [
  {
    icon: Monitor,
    name: "Technology",
    description: "SaaS, platforms & digital products",
  },
  {
    icon: HeartPulse,
    name: "Healthcare",
    description: "Medical tech & health systems",
  },
  {
    icon: TrendingUp,
    name: "Finance",
    description: "Fintech & financial services",
  },
  {
    icon: ShoppingBag,
    name: "Retail",
    description: "E-commerce & retail solutions",
  },
  {
    icon: GraduationCap,
    name: "Education",
    description: "EdTech & learning platforms",
  },
  {
    icon: Factory,
    name: "Manufacturing",
    description: "Industrial & supply chain",
  },
  {
    icon: Building2,
    name: "Real Estate",
    description: "PropTech & property management",
  },
  {
    icon: Plane,
    name: "Travel",
    description: "Hospitality & booking systems",
  },
  {
    icon: Utensils,
    name: "Food & Beverage",
    description: "Restaurant & delivery tech",
  },
  {
    icon: Gamepad2,
    name: "Entertainment",
    description: "Gaming & media platforms",
  },
];

type IndustriesSectionProps = {
  title?: string;
  subtitle?: string;
  className?: string;
  showAll?: boolean;
  columns?: 3 | 4 | 5;
};

export function IndustriesSection({
  title = "Industries We Serve",
  subtitle = "Delivering tailored solutions across diverse sectors",
  className = "",
  showAll = true,
  columns = 5,
}: IndustriesSectionProps) {
  const { ref, isVisible } = useRevealOnView<HTMLElement>({
    threshold: 0.1,
    once: true,
  });

  const displayedIndustries = showAll ? industries : industries.slice(0, 6);

  const gridCols = {
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  };

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

        {/* Industry Grid */}
        <div className={`grid gap-4 ${gridCols[columns]}`}>
          {displayedIndustries.map((industry, index) => {
            const Icon = industry.icon;
            return (
              <div
                key={industry.name}
                className="group relative flex flex-col items-center rounded-xl border border-border/50 bg-card/50 p-6 text-center transition-all duration-500 hover:border-primary/20 hover:bg-card"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(30px)",
                  transitionDelay: `${index * 60}ms`,
                }}
              >
                {/* Icon container with glow effect */}
                <div className="relative mb-4">
                  <div
                    className="absolute -inset-2 rounded-full bg-primary/5 opacity-0 blur-lg transition-opacity duration-500 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 transition-colors duration-300 group-hover:bg-primary/10">
                    <Icon className="h-6 w-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                </div>

                {/* Text */}
                <h3 className="mb-1 text-sm font-medium text-foreground">
                  {industry.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {industry.description}
                </p>

                {/* Hover border effect */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(18, 0, 197, 0.1) 0%, transparent 50%, rgba(18, 0, 197, 0.05) 100%)",
                  }}
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
