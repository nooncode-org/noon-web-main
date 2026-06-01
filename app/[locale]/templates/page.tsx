"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, LayoutGrid, Filter } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SitePageFrame } from "@/app/_components/site/site-page-frame";
import { SiteCtaBlock } from "@/app/_components/site/site-cta-block";
import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import { templates, templateCategories } from "@/data/templates";
import { siteRoutes } from "@/lib/site-config";
import { siteTones } from "@/lib/site-tones";
import { TemplateCard as AnimatedTemplateCard } from "@/components/landing/explore-builds-section";
import { TemplateHeroPreview } from "@/components/sections/premium";

const templateBrandTone = siteTones.brand;

const LOCALES = ["en", "es", "fr", "de"];

// ============================================================================
// PAGE
// ============================================================================

export default function TemplatesPage() {
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
    <SitePageFrame>
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
                className="site-primary-action inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
              >
                {t("hero.startWithMaxwell")}
                <ArrowRight className="w-4 h-4" />
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
            <h2 className="liquid-glass-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono text-muted-foreground">
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
        blockHref={lp(siteRoutes.home)}
        className="!pt-8 !pb-10 lg:!pt-10 lg:!pb-12"
      />
    </SitePageFrame>
  );
}
