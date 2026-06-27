"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { templatesCatalog } from "@/data/templates";
import { getTemplateHref, siteRoutes } from "@/lib/site-config";

export type HeroTemplatesPanelProps = {
  /** Whether the panel is expanded. Driven by the toggle in the Hero badge. */
  open: boolean;
  /** Active locale, used to prefix internal links (`/es/templates/...`). */
  locale: string;
};

/**
 * Collapsible carousel of the site's baseline templates, revealed under the
 * Hero chat input when the user presses the "View Templates" toggle in the blue
 * badge. Shows each template's real thumbnail (`public/templates/*.jpg`) plus a
 * "View All Templates" link and prev/next navigation.
 */
export function HeroTemplatesPanel({ open, locale }: HeroTemplatesPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const localHref = (href: string) => `/${locale}${href}`;

  const scrollByCards = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    // Roughly one viewport-worth of cards per click; smooth-scroll keeps it
    // feeling like a carousel without paginating to exact card boundaries.
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    // grid-rows 1fr/0fr is the height-auto collapse trick: it animates the row
    // from 0 to content height (which `max-height` cannot do for unknown sizes).
    <div
      id="hero-templates-panel"
      aria-hidden={!open}
      className={`grid transition-all duration-500 ease-out ${
        open
          ? "grid-rows-[1fr] opacity-100 mt-0"
          : "grid-rows-[0fr] opacity-0 mt-0 pointer-events-none"
      }`}
    >
      <div className="overflow-hidden rounded-b-[12px] bg-[#0056FD] px-3.5 pb-3.5 pt-1">
        {/* Carousel row */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-smooth pb-2 snap-x text-left [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {templatesCatalog.map((template) => (
            // ----------------------------------------------------------------
            // CARD ACTION — Option 1 (ACTIVE): navigate to the template detail
            // page (`/{locale}/templates/{slug}`).
            //
            // To switch to Option 2 (prefill the Hero chat with the template
            // prompt and start Maxwell), the easiest path is:
            //   1. Add an `onSelect?: (template) => void` prop to this panel.
            //   2. In hero-section.tsx pass:
            //        onSelect={(t) => { setInputValue(t.prompt); startWithMaxwell(); }}
            //      (or simply: router.push(getStartWithMaxwellHref(t.prompt)))
            //   3. Replace this <Link> with a <button onClick={() => onSelect(template)}>.
            // The card markup below stays identical either way.
            // ----------------------------------------------------------------
            <Link
              key={template.slug}
              href={localHref(getTemplateHref(template.slug))}
              className="group relative aspect-[3/2] w-[200px] shrink-0 snap-start overflow-hidden rounded-[10px] border border-foreground/8 bg-[#0056FD] sm:w-[230px]"
            >
              <Image
                src={template.image}
                alt={template.name}
                fill
                sizes="230px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-3 bottom-2.5 drop-shadow">
                <span className="block text-[10px] font-mono uppercase tracking-[0.08em] text-white/70">{template.category}</span>
                <span className="block text-sm font-medium text-white">{template.name}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer: View All + carousel arrows */}
        <div className="mt-3 flex items-center justify-between">
          <Link
            href={localHref(siteRoutes.templates)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            View All Templates
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous templates"
              onClick={() => scrollByCards(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next templates"
              onClick={() => scrollByCards(1)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
