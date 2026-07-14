"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";
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
  const [scrolled, setScrolled] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setScrolled(el.scrollLeft > 4);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const localHref = (href: string) => `/${locale}${href}`;

  // Each template is a visual starting point, so the Home teaser shows ONE card
  // per category (one visual shape) — no repeated looks. The full catalog (with
  // every template) lives on /templates.
  const seenCategories = new Set<string>();
  const heroTemplates = templatesCatalog.filter((t) => {
    if (seenCategories.has(t.category)) return false;
    seenCategories.add(t.category);
    return true;
  });

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
      {/* Padding is gated on `open`: when closed the clipped element must have
          NO padding, otherwise the 18px of pt-1/pb-3.5 keeps the collapsed
          grid row from reaching 0 (padding renders even at height:0). */}
      <div
        className={`min-h-0 overflow-hidden rounded-b-[12px] bg-[#f1f1f1] dark:bg-[#1e1e1e] ${
          open ? "px-3.5 pb-3.5 pt-1" : ""
        }`}
      >
        {/* Carousel row — relative wrapper scoped to scroll area only so
            the absolute fade overlays don't cover the footer. The outer panel
            already has overflow-hidden which clips them at the panel edge. */}
        <div className="relative">
          {scrolled && (
            <div className="pointer-events-none absolute top-0 bottom-2 left-0 z-10 w-14 bg-gradient-to-r from-[#f1f1f1] dark:from-[#1e1e1e] to-transparent" />
          )}
          {!atEnd && (
            <div className="pointer-events-none absolute top-0 bottom-2 right-0 z-10 w-14 bg-gradient-to-l from-[#f1f1f1] dark:from-[#1e1e1e] to-transparent" />
          )}
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scroll-smooth pb-2 snap-x text-left [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
          {heroTemplates.map((template) => (
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
              className="group relative w-[200px] shrink-0 snap-start rounded-[10px] bg-[#f1f1f1] dark:bg-[#131313] p-[3px] sm:w-[230px]"
            >
              {/* Full mockup, framed — card aspect matches the image (16:10) so
                  nothing is cropped; the padding reads as a subtle surround. */}
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[8px] border border-black/10 dark:border-white/10 bg-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)]">
                <Image
                  src={template.image}
                  alt={template.name}
                  fill
                  sizes="230px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                  {template.category}
                </span>
              </div>
            </Link>
          ))}
          </div>
        </div>

        {/* Footer: View All + carousel arrows */}
        <div className="mt-3 flex items-center justify-between">
          <Link
            href={localHref(siteRoutes.templates)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0056fd] transition-opacity hover:opacity-70 ml-1"
          >
            View All Templates
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous templates"
              onClick={() => scrollByCards(-1)}
              className="text-foreground transition-opacity hover:opacity-60"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next templates"
              onClick={() => scrollByCards(1)}
              className="text-foreground transition-opacity hover:opacity-60"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
