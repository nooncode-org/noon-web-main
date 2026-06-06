"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Check, Filter, Gauge, LayoutGrid, LayoutTemplate, Minus, Shapes } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SiteCtaBlock } from "@/app/_components/site/site-cta-block";
import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import { templates, templateCategories, templatePrinciples, templateSelectionGuides } from "@/data/templates";
import { siteRoutes } from "@/lib/site-config";
import { siteTones } from "@/lib/site-tones";
import { TemplateCard as AnimatedTemplateCard } from "@/components/landing/explore-builds-section";
import { TemplateHeroPreview } from "@/components/sections/premium";

const templateBrandTone = siteTones.brand;

// Icons for the 3 "how templates work" principles (structured start / faster /
// shaped to the real problem) so the cards aren't text-only.
const TEMPLATE_PRINCIPLE_ICONS = [LayoutTemplate, Gauge, Shapes] as const;

const LOCALES = ["en", "es", "fr", "de"];

// ============================================================================
// PAGE
// ============================================================================

export function TemplatesContent() {
  const params = useParams();
  const paramLocale = typeof params?.locale === "string" ? params.locale : null;
  const locale = (paramLocale && LOCALES.includes(paramLocale) ? paramLocale : "en");
  const lp = (href: string) => `/${locale}${href}`;

  const t = useTranslations("templates");

  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filteredTemplates = useMemo(() => {
    if (!activeFilter) return templates;
    return templates.filter((t) => t.category === activeFilter);
  }, [activeFilter]);

  const { ref: headerRef, isVisible: headerVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.1 });
  const { ref: filterRef, isVisible: filterVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.1 });

  return (
    <>
      {/* Hero */}
      <section ref={headerRef} className="site-hero-section pb-4 lg:pb-5">
        <div className="site-shell">
          <div className="rounded-[9px] bg-[#f9f9f9]/95 p-6 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.06)] backdrop-blur-sm dark:bg-[#131313]/92 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] sm:p-8 lg:p-10">
            <h1
              className={`site-hero-title mx-auto mb-5 max-w-4xl transition-all duration-700 ${headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: "100ms" }}
            >
              {t("hero.headline")}
            </h1>
            <p
              className={`site-hero-copy mx-auto mb-8 max-w-4xl text-muted-foreground transition-all duration-700 ${headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: "200ms" }}
            >
              {t("hero.description")}
            </p>
            <div
              className={`flex flex-wrap justify-center gap-4 transition-all duration-700 ${headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: "300ms" }}
            >
              <Link
                href={lp(siteRoutes.maxwellStudio)}
                className="group site-primary-action inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
              >
                {t("hero.startWithMaxwell")}
                <ArrowRight className="w-4 h-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
              </Link>
              <Link
                href={lp(siteRoutes.services)}
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary"
              >
                {t("hero.viewServices")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Premium: Template hero preview */}
      <TemplateHeroPreview className="bg-background" />

      {/* Enrichment — how Noon templates work: real principles + selection
         guide (templatePrinciples / templateSelectionGuides, previously
         unrendered). Sets honest expectations: a structured starting point,
         not a boxed product. */}
      <section className="site-section">
        <div className="site-shell">
          <div className="mb-8 max-w-2xl lg:mb-10">
            <span className="site-meta-label mb-4 inline-flex items-center gap-3 font-mono text-muted-foreground">
              <span className="h-px w-8 bg-foreground/30" />
              How templates work
            </span>
            <h2 className="site-section-title">
              Structured starting points, <span className="text-muted-foreground">not boxed products.</span>
            </h2>
          </div>

          {/* the 3 principles — hairline 3-up */}
          <div className="overflow-hidden border border-foreground/10">
            <div className="grid gap-px bg-foreground/10 lg:grid-cols-3">
              {templatePrinciples.map((p, i) => {
                const Icon = TEMPLATE_PRINCIPLE_ICONS[i] ?? LayoutTemplate;
                return (
                <div key={p.title} className="bg-background p-6 lg:p-7">
                  <span
                    className="mb-3 flex h-8 w-8 items-center justify-center rounded-[8px] text-primary"
                    style={{ backgroundColor: "rgba(18,0,197,0.10)" }}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <h3 className="text-[15px] font-medium leading-snug text-foreground">{p.title}</h3>
                  <p className="mt-2 text-sm leading-snug text-muted-foreground">{p.description}</p>
                </div>
                );
              })}
            </div>
          </div>

          {/* selection guide — when to use / when not */}
          <div className="mt-4 overflow-hidden border border-foreground/10">
            <div className="grid gap-px bg-foreground/10 lg:grid-cols-3">
              {templateSelectionGuides.map((g, i) => (
                <div key={g.title} className="flex flex-col bg-background p-6 lg:p-7">
                  <span
                    className={`mb-3 flex h-7 w-7 items-center justify-center rounded-[8px] ${
                      i === 0 ? "text-primary" : "border border-foreground/15 text-muted-foreground"
                    }`}
                    style={i === 0 ? { backgroundColor: "rgba(18,0,197,0.10)" } : undefined}
                  >
                    {i === 0 ? (
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    ) : (
                      <Minus className="h-4 w-4" strokeWidth={2.5} />
                    )}
                  </span>
                  <h3 className="text-sm font-medium leading-snug text-foreground">{g.title}</h3>
                  <p className="mt-1.5 text-sm leading-snug text-muted-foreground">{g.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Templates by category */}
      <section className="site-section bg-secondary/30">
        <div className="site-shell">
          {/* Enhanced: Category filter chips */}
          <div
            ref={filterRef}
            className={`mb-8 transition-all duration-700 ${filterVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-mono uppercase tracking-[0.1em] text-muted-foreground">
                Filter by category
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveFilter(null)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 ${
                  activeFilter === null
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background/60 text-foreground hover:border-primary/50 hover:bg-background"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                All
              </button>
              {templateCategories.map((category, index) => (
                <button
                  key={category}
                  onClick={() => setActiveFilter(category)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 ${
                    activeFilter === category
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background/60 text-foreground hover:border-primary/50 hover:bg-background"
                  }`}
                  style={{
                    transitionDelay: `${index * 30}ms`,
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-secondary/40 px-3 py-1 text-xs font-mono text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: templateBrandTone.accent }} />
              {activeFilter || t("allTemplates")}
            </h2>
            <span className="text-xs font-mono" style={{ color: templateBrandTone.accent }}>
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTemplates.map((template, index) => (
              <div
                key={template.slug}
                className="transition-all duration-500"
                style={{
                  animation: "reveal-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards",
                  animationDelay: `${index * 50}ms`,
                  opacity: 0,
                }}
              >
                <AnimatedTemplateCard template={template} index={index} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteCtaBlock
        title={t("cta.headline")}
        description={t("cta.description")}
        blockHref={lp(siteRoutes.maxwellStudio)}
        className="!pt-8 !pb-10 lg:!pt-10 lg:!pb-12"
      />
    </>
  );
}
