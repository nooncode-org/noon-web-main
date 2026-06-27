"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { LayoutGrid, Search } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SiteCtaBlock } from "@/app/_components/site/site-cta-block";
import { FaqSection, type Faq } from "@/components/landing/faq-section";
import { templatesCatalog, templateCatalogCategories } from "@/data/templates";
import { siteRoutes, getTemplateHref } from "@/lib/site-config";

// Templates-specific FAQ — every answer mirrors copy already on this page
// or the established Maxwell/service routes.
const TEMPLATES_FAQS: Faq[] = [
  {
    question: "Are these finished products I just buy?",
    answer:
      "No — they're structured starting points, not boxed products. Each template is a pre-defined scope for a common software type, adapted to your business before anything ships.",
  },
  {
    question: "What exactly do I get?",
    answer:
      "A complete, production-ready codebase — real software you can deploy and customize, with foundations like auth and database already in place, delivered as code you own.",
  },
  {
    question: "How do I start from a template?",
    answer:
      "Start with Maxwell: pick the closest template, describe your business, and Maxwell turns that starting point into a clear scope — what's in and out, agreed up front — before the build.",
  },
  {
    question: "What if none of them fits?",
    answer:
      "That's normal — templates cover common shapes. Anything non-standard is exactly what Custom Development is for: tell us what you need and we'll route it correctly.",
  },
];

const LOCALES = ["en", "es", "fr", "de"];

// ============================================================================
// PAGE — V0-style templates browser: big title + search, a visual "Browse by
// category" row, and a clean grid of preview+title cards (the whole card links
// to the template detail). No heavy summaries/tags/CTAs on the cards.
// ============================================================================

export function TemplatesContent() {
  const params = useParams();
  const paramLocale = typeof params?.locale === "string" ? params.locale : null;
  const locale = paramLocale && LOCALES.includes(paramLocale) ? paramLocale : "en";
  const lp = (href: string) => `/${locale}${href}`;

  const t = useTranslations("templates");

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Representative cover per category for the "Browse by category" row — first
  // template found in each category, using its real mockup render.
  const categoryReps = useMemo(
    () =>
      templateCatalogCategories.map((category) => {
        const rep = templatesCatalog.find((tpl) => tpl.category === category);
        return { category, image: rep?.image ?? "" };
      }),
    [],
  );

  const filtered = useMemo(() => {
    let list = activeFilter
      ? templatesCatalog.filter((tpl) => tpl.category === activeFilter)
      : templatesCatalog;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (tpl) =>
          tpl.name.toLowerCase().includes(q) ||
          tpl.category.toLowerCase().includes(q) ||
          tpl.summary.toLowerCase().includes(q),
      );
    }
    return list;
  }, [activeFilter, query]);

  return (
    <>
      {/* Header — big title + subtitle + centered search (V0 model) */}
      <section className="site-hero-section pb-6 lg:pb-8">
        <div className="site-shell">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="site-hero-title mb-4">{t("hero.headline")}</h1>
            <p className="site-hero-copy mx-auto mb-8 max-w-2xl text-muted-foreground">
              {t("hero.description")}
            </p>
            <div className="mx-auto flex max-w-lg items-center gap-2.5 rounded-full border border-border bg-background/70 px-4 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-colors focus-within:border-foreground/30">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates…"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Browse by category — bigger, framed cards (V0-inspired). One large
         preview per card (we have ~1 template per category, so no 4-up mosaic). */}
      <section className="site-section py-10 lg:py-14">
        <div className="site-shell">
          <div className="mb-6 flex items-end justify-between">
            <div className="space-y-2.5">
              <span className="inline-flex items-center gap-3 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <span className="h-px w-8 bg-foreground/30" />
                Browse by category
              </span>
              <h2 className="text-xl font-medium tracking-tight text-foreground lg:text-[1.6rem]">
                Pick a starting point
              </h2>
            </div>
            {activeFilter && (
              <button
                onClick={() => setActiveFilter(null)}
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Show all
              </button>
            )}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3 snap-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {categoryReps.map((c) => {
              const active = activeFilter === c.category;
              const count = templatesCatalog.filter((t) => t.category === c.category).length;
              return (
                <button
                  key={c.category}
                  onClick={() => setActiveFilter(active ? null : c.category)}
                  className="group w-[300px] shrink-0 snap-start text-left sm:w-[340px]"
                >
                  <div
                    className={`overflow-hidden rounded-[14px] border transition-all duration-300 ${
                      active
                        ? "border-foreground/70 ring-1 ring-foreground/15"
                        : "border-foreground/15 group-hover:border-foreground/35"
                    }`}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-background">
                      {c.image ? (
                        <Image
                          src={c.image}
                          alt={c.category}
                          fill
                          sizes="340px"
                          className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="h-full w-full bg-secondary" />
                      )}
                    </div>
                    <div className="flex items-baseline justify-between gap-2 border-t border-foreground/10 px-3.5 py-3">
                      <span
                        className={`text-base font-medium transition-colors ${
                          active ? "text-foreground" : "text-foreground/90 group-hover:text-foreground"
                        }`}
                      >
                        {c.category}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground/50">
                        {count} template{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Templates grid — clean cards: preview + title + category; whole card
         links to the template detail. */}
      <section className="site-section pt-0">
        <div className="site-shell">
          <div className="mb-6 flex items-baseline justify-between border-t border-foreground/8 pt-6">
            <h2 className="text-base font-medium text-foreground">
              {activeFilter ?? t("allTemplates")}
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {filtered.length} template{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((template) => (
                <Link
                  key={template.slug}
                  href={lp(getTemplateHref(template.slug))}
                  className="group block"
                >
                  <div className="relative aspect-[16/10] overflow-hidden rounded-[12px] border border-foreground/10 bg-secondary/20 transition-colors duration-300 group-hover:border-foreground/25">
                    <Image
                      src={template.image}
                      alt={template.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="mt-3">
                    <h3 className="text-[15px] font-medium leading-snug text-foreground">
                      {template.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{template.category}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No templates match “{query}”.
            </p>
          )}
        </div>
      </section>

      {/* Templates-specific FAQ */}
      <FaqSection items={TEMPLATES_FAQS} />

      <SiteCtaBlock
        title={t("cta.headline")}
        description={t("cta.description")}
        blockHref={lp(siteRoutes.maxwellStudio)}
        className="!pt-8 !pb-10 lg:!pt-10 lg:!pb-12"
      />
    </>
  );
}
