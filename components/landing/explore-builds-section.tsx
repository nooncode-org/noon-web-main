"use client";

import Link from "next/link";
import { useState } from "react";
import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import { ArrowRight } from "lucide-react";
import { getTemplateHref, getStartWithMaxwellHref, siteRoutes } from "@/lib/site-config";
import { siteTones } from "@/lib/site-tones";
import { templates, type TemplateCatalogItem } from "@/data/templates";

// ============================================================================
// Category tone map
// ============================================================================

const categoryTone = (category: string) => {
  switch (category) {
    case "SaaS": return siteTones.brand;
    case "Dashboards": return siteTones.client;
    case "Internal tools": return siteTones.gateway;
    case "AI assistants": return siteTones.data;
    case "Marketplaces": return siteTones.services;
    case "Booking platforms": return siteTones.services;
    case "E-commerce": return siteTones.services;
    case "Mobile apps": return siteTones.data;
    default: return siteTones.brand;
  }
};

// ============================================================================
// Mockups — always visible, extra animations on hover (enhanced)
// ============================================================================

function SaaSMockup({ enhanced }: { enhanced: boolean }) {
  return (
    <div className="absolute inset-4 bg-background rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/30">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-foreground/15" />
          <span className="w-2 h-2 rounded-full bg-foreground/15" />
          <span className="w-2 h-2 rounded-full bg-foreground/15" />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground ml-1">client-portal</span>
      </div>
      <div className="flex h-full">
        <div className="w-14 border-r border-border bg-secondary/20 py-3 space-y-2 px-2">
          {["Home", "Proj", "Bill", "Sett"].map((l, i) => (
            <div key={l}
              className="rounded-md px-1.5 py-1 text-[9px] transition-all duration-300"
              style={i === 0 ? { backgroundColor: siteTones.brand.accent, color: "white" } : { color: "var(--muted-foreground)" }}>
              {l}
            </div>
          ))}
        </div>
        <div className="flex-1 p-3 space-y-2">
          <div className="h-2.5 w-24 rounded bg-foreground/80" />
          <div className="grid grid-cols-2 gap-2 mt-2">
            {[siteTones.brand, siteTones.data, siteTones.gateway, siteTones.services].map((t, i) => (
              <div key={i}
                className="rounded-lg border p-2 transition-all duration-500"
                style={{
                  borderColor: t.border,
                  backgroundColor: t.surface,
                  transform: enhanced ? "scale(1.04)" : "scale(1)",
                  transitionDelay: `${i * 60}ms`,
                }}>
                <div className="h-1 w-8 rounded mb-1" style={{ backgroundColor: t.accent }} />
                <div className={`h-3 rounded bg-foreground/10 transition-all duration-500 ${enhanced ? "w-full" : "w-8"}`} style={{ transitionDelay: `${i * 60}ms` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardMockup({ enhanced }: { enhanced: boolean }) {
  return (
    <div className="absolute inset-4 bg-background rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/30">
        <span className="text-[10px] font-mono text-muted-foreground">operations · live</span>
        <span className={`w-1.5 h-1.5 rounded-full ${enhanced ? "animate-ping" : "animate-pulse"}`} style={{ backgroundColor: siteTones.gateway.accent }} />
      </div>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {[{ v: "$47K", l: "Revenue" }, { v: "1.2K", l: "Orders" }, { v: "+23%", l: "Growth" }].map((s, i) => (
            <div key={s.l}
              className="bg-secondary/50 rounded-lg p-2 transition-all duration-400"
              style={{ transform: enhanced ? "translateY(-2px)" : "translateY(0)", transitionDelay: `${i * 60}ms` }}>
              <p className="text-[8px] text-muted-foreground">{s.l}</p>
              <p className={`text-xs font-semibold transition-all duration-300 ${enhanced ? "text-foreground" : "text-foreground/70"}`}>{s.v}</p>
            </div>
          ))}
        </div>
        <div className="h-16 rounded-lg bg-secondary/30 overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 200 50" preserveAspectRatio="none">
            <path d="M0,40 Q40,32 80,24 T160,18 T200,10"
              fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground/40"
              style={{
                strokeDasharray: 300,
                strokeDashoffset: 0,
                filter: enhanced ? "drop-shadow(0 0 3px currentColor)" : "none",
                transition: "filter 0.4s ease",
              }} />
            {enhanced && (
              <circle r="3" fill={siteTones.gateway.accent} className="animate-pulse">
                <animateMotion dur="2s" repeatCount="indefinite"
                  path="M0,40 Q40,32 80,24 T160,18 T200,10" />
              </circle>
            )}
          </svg>
        </div>
        <div className="space-y-1">
          {[1, 2].map(i => (
            <div key={i}
              className="h-5 rounded bg-secondary/50 transition-all duration-300"
              style={{ width: enhanced ? "100%" : `${70 + i * 10}%`, transitionDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkflowMockup({ enhanced }: { enhanced: boolean }) {
  const statuses = [
    { label: "Design review", status: "Pending" },
    { label: "Budget approval", status: "Approved" },
    { label: "Legal clearance", status: "Escalated" },
  ];
  return (
    <div className="absolute inset-4 bg-background rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/30">
        <span className="text-[10px] font-mono text-muted-foreground">approval queue</span>
        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full transition-all duration-300"
          style={{ backgroundColor: siteTones.gateway.surface, color: siteTones.gateway.accent,
            transform: enhanced ? "scale(1.08)" : "scale(1)" }}>
          12 pending
        </span>
      </div>
      <div className="p-3 space-y-1.5">
        {statuses.map(({ label, status }, i) => (
          <div key={label}
            className="flex items-center justify-between rounded-lg border border-border px-3 py-2 transition-all duration-300"
            style={{
              transform: enhanced ? "translateX(3px)" : "translateX(0)",
              transitionDelay: `${i * 70}ms`,
              backgroundColor: enhanced && i === 0 ? "var(--secondary)" : "transparent",
            }}>
            <span className="text-[10px]">{label}</span>
            <span className="text-[9px] rounded-full px-2 py-0.5 transition-all duration-300"
              style={{
                backgroundColor: status === "Approved" ? siteTones.gateway.surface : status === "Escalated" ? siteTones.services.surface : "var(--secondary)",
                color: status === "Approved" ? siteTones.gateway.accent : status === "Escalated" ? siteTones.services.accent : "var(--muted-foreground)",
                transform: enhanced ? "scale(1.05)" : "scale(1)",
              }}>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIMockup({ enhanced }: { enhanced: boolean }) {
  return (
    <div className="absolute inset-4 bg-background rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/30">
        <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${enhanced ? "animate-ping" : "animate-pulse"}`}
          style={{ backgroundColor: siteTones.data.accent }} />
        <span className="text-[10px] font-mono text-muted-foreground">AI assistant · online</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex justify-end">
          <div className="bg-foreground text-background text-[10px] px-3 py-1.5 rounded-2xl rounded-tr-sm max-w-[75%] transition-all duration-300"
            style={{ transform: enhanced ? "scale(1.03)" : "scale(1)" }}>
            How do I reset my password?
          </div>
        </div>
        <div className="flex justify-start">
          <div className="text-[10px] px-3 py-1.5 rounded-2xl rounded-tl-sm max-w-[80%] border border-border bg-secondary/30 transition-all duration-300"
            style={{
              borderColor: enhanced ? siteTones.data.border : "var(--border)",
              backgroundColor: enhanced ? siteTones.data.surface : "var(--secondary)",
            }}>
            I can help! I&apos;ll send a reset link to your email right now.
          </div>
        </div>
        <div className="flex gap-1 px-3">
          {[0, 1, 2].map(i => (
            <span key={i}
              className={`rounded-full bg-muted-foreground transition-all duration-300 ${enhanced ? "animate-bounce" : ""}`}
              style={{ width: enhanced ? "6px" : "5px", height: enhanced ? "6px" : "5px", animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketplaceMockup({ enhanced }: { enhanced: boolean }) {
  return (
    <div className="absolute inset-4 bg-background rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/30">
        <span className="text-[10px] font-mono text-muted-foreground">marketplace</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-foreground text-background transition-all duration-300"
          style={{ transform: enhanced ? "scale(1.08)" : "scale(1)" }}>
          Cart (3)
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i}
            className="rounded-lg overflow-hidden border border-border transition-all duration-300"
            style={{ transform: enhanced ? "translateY(-2px) scale(1.02)" : "translateY(0) scale(1)", transitionDelay: `${i * 50}ms` }}>
            <div className="aspect-square bg-secondary/50 flex items-center justify-center">
              <div className={`rounded transition-all duration-300 ${enhanced ? "w-8 h-8 bg-foreground/20" : "w-6 h-6 bg-foreground/10"}`} />
            </div>
            <div className="p-1.5">
              <div className="h-1.5 bg-foreground/10 rounded w-3/4 mb-1" />
              <div className="h-1.5 bg-foreground/20 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingMockup({ enhanced }: { enhanced: boolean }) {
  const highlighted = [8, 12, 15];
  return (
    <div className="absolute inset-4 bg-background rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/30">
        <span className="text-[10px] font-mono text-muted-foreground">reservations · Apr 2026</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-7 gap-0.5">
          {["M","T","W","T","F","S","S"].map((d, i) => (
            <div key={i} className="text-center text-[8px] text-muted-foreground">{d}</div>
          ))}
          {Array.from({ length: 21 }, (_, i) => i + 1).map(d => (
            <div key={d}
              className="aspect-square flex items-center justify-center rounded text-[9px] transition-all duration-300"
              style={
                highlighted.includes(d)
                  ? {
                      backgroundColor: siteTones.services.accent,
                      color: "white",
                      transform: enhanced ? "scale(1.15)" : "scale(1)",
                    }
                  : { color: "var(--foreground)", opacity: 0.5 }
              }>
              {d}
            </div>
          ))}
        </div>
        <div className="rounded-lg border px-3 py-2 text-[10px] transition-all duration-300"
          style={{
            borderColor: siteTones.services.border,
            backgroundColor: enhanced ? siteTones.services.surface : "transparent",
            color: siteTones.services.accent,
          }}>
          Apr 8 — 2 slots available
        </div>
      </div>
    </div>
  );
}

function EcommerceMockup({ enhanced }: { enhanced: boolean }) {
  return (
    <div className="absolute inset-4 bg-background rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/30">
        <span className="text-[10px] font-mono text-muted-foreground">storefront</span>
        <span className="text-[9px] text-muted-foreground transition-all duration-300"
          style={{ color: enhanced ? siteTones.services.accent : undefined }}>
          24 orders today
        </span>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <div className="w-16 h-16 rounded-lg bg-secondary/50 shrink-0 transition-all duration-300"
            style={{ transform: enhanced ? "scale(1.05)" : "scale(1)" }} />
          <div className="flex-1 space-y-1.5 pt-0.5">
            <div className="h-2 bg-foreground/80 rounded w-3/4" />
            <div className="h-1.5 bg-foreground/20 rounded w-1/2" />
            <div className="mt-1 h-2 rounded w-12 transition-all duration-300"
              style={{
                backgroundColor: siteTones.services.accent,
                width: enhanced ? "3.5rem" : "3rem",
              }} />
          </div>
        </div>
        {[1, 2].map(i => (
          <div key={i}
            className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 transition-all duration-300"
            style={{
              borderColor: enhanced ? siteTones.services.border : "var(--border)",
              backgroundColor: enhanced ? siteTones.services.surface : "transparent",
              transitionDelay: `${i * 60}ms`,
            }}>
            <div className="w-7 h-7 rounded bg-secondary/60 shrink-0" />
            <div className="flex-1">
              <div className="h-1.5 bg-foreground/20 rounded w-2/3 mb-1" />
              <div className="h-1.5 bg-foreground/10 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileMockup({ enhanced }: { enhanced: boolean }) {
  return (
    <div className="absolute inset-4 flex items-center justify-center">
      <div className="w-24 bg-background rounded-2xl border-2 border-border overflow-hidden shadow-xl transition-all duration-400"
        style={{ transform: enhanced ? "scale(1.06) translateY(-3px)" : "scale(1) translateY(0)", boxShadow: enhanced ? "0 16px 32px -8px rgba(0,0,0,0.18)" : undefined }}>
        <div className="flex items-center justify-center py-1 border-b border-border">
          <div className="w-6 h-1 rounded-full bg-foreground/20" />
        </div>
        <div className="p-2 space-y-1.5">
          <div className="rounded-lg p-1.5 transition-all duration-300"
            style={{ backgroundColor: siteTones.data.surface }}>
            <div className="h-1 rounded mb-1 transition-all duration-300"
              style={{ backgroundColor: siteTones.data.accent, width: enhanced ? "80%" : "60%" }} />
            <div className="h-1 bg-foreground/10 rounded w-4/5" />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i}
              className="h-6 rounded-lg bg-secondary/50 flex items-center gap-1.5 px-2 transition-all duration-300"
              style={{
                transform: enhanced ? `translateX(${i % 2 === 0 ? 2 : -2}px)` : "translateX(0)",
                transitionDelay: `${i * 60}ms`,
              }}>
              <div className="w-2 h-2 rounded-full transition-all duration-300"
                style={{ backgroundColor: siteTones.data.accent, transform: enhanced ? "scale(1.2)" : "scale(1)" }} />
              <div className="h-1 bg-foreground/15 rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Assign mockup by category
const MockupByCategory: Record<string, React.ComponentType<{ enhanced: boolean }>> = {
  "SaaS": SaaSMockup,
  "Dashboards": DashboardMockup,
  "Internal tools": WorkflowMockup,
  "AI assistants": AIMockup,
  "Marketplaces": MarketplaceMockup,
  "Booking platforms": BookingMockup,
  "E-commerce": EcommerceMockup,
  "Mobile apps": MobileMockup,
};

// Exported so the template detail page can reuse the SAME faithful code mockup
// as the card grid (instead of a separate, AI-generated preview image).
export function TemplateMockup({ category, enhanced = false }: { category: string; enhanced?: boolean }) {
  const Mockup = MockupByCategory[category] ?? SaaSMockup;
  return <Mockup enhanced={enhanced} />;
}

// ============================================================================
// Template Card
// ============================================================================

export function TemplateCard({ template, index }: { template: TemplateCatalogItem; index: number }) {
  const [hovered, setHovered] = useState(false);
  const { ref, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.15 });
  const tone = categoryTone(template.category);
  const Mockup = MockupByCategory[template.category] ?? SaaSMockup;

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative flex flex-col bg-background/88 border border-foreground/8 rounded-[10px] overflow-hidden transition-all duration-700 hover:border-foreground/14 hover:shadow-md ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      {/* Mockup preview area */}
      <div className={`relative h-44 lg:h-52 overflow-hidden bg-foreground/[0.035] transition-colors duration-500 ${hovered ? "bg-foreground/[0.06]" : ""}`}>
        <Mockup enhanced={hovered} />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5 lg:p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base lg:text-lg font-display leading-snug pr-2">{template.name}</h3>
          <span
            className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full border"
            style={{ backgroundColor: tone.surface, borderColor: tone.border, color: tone.accent }}
          >
            {template.category}
          </span>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">
          {template.summary}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {template.bestFit.map((tag) => (
            <span key={tag} className="text-[11px] text-foreground/60 bg-secondary/60 px-2.5 py-1 rounded-full border border-foreground/6">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <a
            href={getStartWithMaxwellHref(template.prompt)}
            className="site-primary-action inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
          >
            Start with Maxwell
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
          <Link
            href={getTemplateHref(template.slug)}
            className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View details
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ExploreBuildsSection
// ============================================================================

export function ExploreBuildsSection() {
  const { ref: sectionRef, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.08 });

  return (
    <section
      id="explore-what-you-can-build"
      ref={sectionRef}
      className="relative py-20 lg:py-24 bg-secondary/30"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-12 lg:mb-16 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <span className="mb-6 liquid-glass-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: siteTones.brand.accent }} />
              Templates
            </span>
            <h2
              className={`text-3xl lg:text-4xl font-display tracking-tight mb-4 transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              Start from a proven baseline.
            </h2>
            <p
              className={`text-base lg:text-[17px] text-muted-foreground leading-relaxed transition-all duration-700 delay-100 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              Structured starting points that accelerate scoping and delivery — not themes, not boxed products. Hover to see them come alive.
            </p>
          </div>
          <Link
            href={siteRoutes.templates}
            className={`inline-flex items-center gap-2 text-sm font-medium text-foreground shrink-0 transition-all duration-700 delay-200 hover:gap-3 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            View all templates
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {templates.map((template, index) => (
            <TemplateCard key={template.slug} template={template} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
