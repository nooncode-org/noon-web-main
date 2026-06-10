"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, DollarSign, Layers, Settings, ShoppingCart } from "lucide-react";
import { SiteCtaBlock } from "@/app/_components/site/site-cta-block";
import { ContactRouteDiagram } from "@/components/sections/contact-route-diagram";
import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import { getContactHref, siteRoutes } from "@/lib/site-config";
import { siteTones } from "@/lib/site-tones";

const LOCALES = ["en", "es", "fr", "de"];

type EcosystemArea = {
  title: string;
  description: string;
  tags: string[];
  tone: typeof siteTones.brand;
  Icon: LucideIcon;
};

// Content ported from the Figma "Oportunities" frame (ecosystem entry points).
// Per Figma, each card uses a category-specific icon (dollar / cart / gear /
// layers) inside a dark-bg + accent-border square. The sandbox AreasGrid.tsx
// simplified these to a generic ArrowRight, but the Figma is the source of
// truth and uses distinct icons per area.
const areas: EcosystemArea[] = [
  {
    title: "Invest",
    description:
      "Capital partnerships for projects with proven business logic, real users, and an operational base that can scale.",
    tags: ["Equity", "Revenue share", "Acquisition"],
    tone: siteTones.brand,
    Icon: DollarSign,
  },
  {
    title: "Sellers",
    description:
      "Bring digital products, internal tools, or specialized systems to a network that values working software over polished demos.",
    tags: ["Direct", "Revenue share", "Distribution"],
    tone: siteTones.services,
    Icon: ShoppingCart,
  },
  {
    title: "Developers",
    description:
      "Engineering work on real production systems. Remote, project-based, with clear scope and explicit ownership of contributions.",
    tags: ["Project-based", "Remote", "Contributor agreement"],
    tone: siteTones.gateway,
    Icon: Settings,
  },
  {
    title: "Partners",
    description:
      "Operational partnerships for service delivery, infrastructure, or distribution channels where alignment matters more than scale.",
    tags: ["Revenue share", "Distribution", "Services", "Long-term"],
    tone: siteTones.data,
    Icon: Layers,
  },
];

export function OpportunitiesContent() {
  const params = useParams();
  const paramLocale = typeof params?.locale === "string" ? params.locale : null;
  const locale = paramLocale && LOCALES.includes(paramLocale) ? paramLocale : "en";
  const lp = (href: string) => `/${locale}${href}`;
  const contactHref = lp(getContactHref({ inquiry: "general", source: "opportunities" }));

  const { ref: headerRef, isVisible: headerVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.1 });
  const { ref: areasRef, isVisible: areasVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.1 });
  const { ref: howRef, isVisible: howVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.15 });

  return (
    <>
      <div>
        {/* Hero — open grid, color-split headline (Figma frame 73:90) */}
        <section ref={headerRef} className="site-hero-section relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 [--gl:rgba(17,17,17,0.07)] dark:[--gl:rgba(255,255,255,0.06)]"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--gl) 1px, transparent 1px), linear-gradient(to bottom, var(--gl) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
              backgroundPosition: "center",
              maskImage: "radial-gradient(ellipse 65% 62% at 50% 42%, #000 22%, transparent 80%)",
              WebkitMaskImage: "radial-gradient(ellipse 65% 62% at 50% 42%, #000 22%, transparent 80%)",
            }}
          />
          <div className="site-shell relative">
            <div className="mx-auto max-w-3xl py-12 text-center lg:py-16">
              <h1
                className={`site-hero-title mb-5 transition-all duration-700 ${
                  headerVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: "100ms" }}
              >
                <span className="text-muted-foreground">Four ways to be part of the</span>{" "}
                Noon ecosystem.
              </h1>
              <p
                className={`site-hero-copy mx-auto mb-8 max-w-2xl text-muted-foreground transition-all duration-700 ${
                  headerVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: "200ms" }}
              >
                Noon is building more than a services firm. Investors, Sellers, Developers and
                Partners — each have a distinct entry point — structured, practical, and open to the
                right people.
              </p>
              <div
                className={`flex justify-center transition-all duration-700 ${
                  headerVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: "300ms" }}
              >
                <Link
                  href={contactHref}
                  className="group site-primary-action inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
                >
                  Contact Noon
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Areas — Invest / Sellers / Developers / Partners (Figma 2×2 grid) */}
        <section ref={areasRef} className="site-section">
          <div className="site-shell">
            <span className="liquid-glass-pill mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: siteTones.brand.accent }} />
              Areas
            </span>
            <h2 className="site-section-title mb-3">Four ways to work with Noon</h2>
            <p className="site-section-copy mb-8 max-w-2xl text-muted-foreground">
              Each path uses the same contact route. The category just tells Noon which conversation
              to start from.
            </p>

            <div className="grid gap-4 md:grid-cols-2 lg:gap-5">
              {areas.map((area, index) => {
                const { Icon } = area;
                return (
                  <article
                    key={area.title}
                    className={`flex min-h-[200px] flex-col border border-foreground/10 bg-card/60 p-6 transition-all duration-700 lg:min-h-[210px] lg:p-7 ${
                      areasVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                    }`}
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="site-card-title">{area.title}</h3>
                      {/* Figma canon: dark translucent bg + accent-colored border,
                         category-specific icon per area (Invest=$, Sellers=cart,
                         Developers=gear, Partners=layers). */}
                      <Link
                        href={contactHref}
                        aria-label={`Contact about ${area.title}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center border bg-background/40 text-foreground transition-colors hover:bg-background/70"
                        style={{ borderColor: "rgba(18, 0, 197, 0.65)" }}
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </Link>
                    </div>
                    <p className="site-card-copy mt-4 text-muted-foreground">{area.description}</p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                      {area.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full border border-foreground/10 bg-secondary/40 px-3 py-1 font-mono text-[11px] leading-none text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works — single contact route + iso cube (Figma frame 139:327) */}
        <section ref={howRef} className="site-section bg-secondary/30">
          <div className="site-shell">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div
                className={`transition-all duration-700 ${
                  howVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                }`}
              >
                <span className="liquid-glass-pill mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: siteTones.brand.accent }} />
                  How it works
                </span>
                <h2 className="site-section-title mb-3">One contact route for all paths</h2>
                <p className="site-section-copy mb-6 text-muted-foreground">
                  Every path uses the same intake form. Pick the closest category, describe what you
                  bring, and Noon routes the request to the right conversation.
                </p>
                <div className="border border-foreground/10 bg-background/60 p-5 lg:p-6">
                  <p className="site-card-copy text-foreground/85">
                    If your case doesn&apos;t fit a category, send it as a general question. The
                    review still happens — the routing just takes one extra step.
                  </p>
                </div>
              </div>
              <div
                className={`transition-all duration-700 ${
                  howVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                }`}
                style={{ transitionDelay: "150ms" }}
              >
                <ContactRouteDiagram />
              </div>
            </div>
          </div>
        </section>

        <SiteCtaBlock
          title="Ready to build?"
          description="Start a conversation with Maxwell or reach out directly."
          blockHref={lp(siteRoutes.maxwellStudio)}
          className="!pt-8 !pb-10 lg:!pt-10 lg:!pb-12"
        />
      </div>
    </>
  );
}
