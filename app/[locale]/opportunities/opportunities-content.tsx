"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, DollarSign, Layers, Settings, ShoppingCart } from "lucide-react";
import { EcosystemGlobe } from "./ecosystem-globe";
import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import { getContactHref, siteRoutes } from "@/lib/site-config";

const LOCALES = ["en", "es", "fr", "de"];

type EcosystemArea = {
  title: string;
  description: string;
  Icon: LucideIcon;
  href?: string; // per-area destination (TBD by owner); falls back to contactHref
};

// Four ecosystem entry points. Neutral/mono per the redesign spine — the icons
// distinguish them; no per-card accent colours.
const AREAS: EcosystemArea[] = [
  {
    title: "Invest",
    description:
      "Capital partnerships for projects with proven business logic, real users, and an operational base that can scale.",
    Icon: DollarSign,
  },
  {
    title: "Sellers",
    description:
      "Bring digital products, internal tools, or specialized systems to a network that values working software over polished demos.",
    Icon: ShoppingCart,
  },
  {
    title: "Developers",
    description:
      "Engineering work on real production systems. Remote, project-based, with clear scope and explicit ownership of contributions.",
    Icon: Settings,
  },
  {
    title: "Partners",
    description:
      "Operational partnerships for service delivery, infrastructure, or distribution channels where alignment matters more than scale.",
    Icon: Layers,
  },
];

export function OpportunitiesContent() {
  const params = useParams();
  const paramLocale = typeof params?.locale === "string" ? params.locale : null;
  const locale = paramLocale && LOCALES.includes(paramLocale) ? paramLocale : "en";
  const lp = (href: string) => `/${locale}${href}`;
  const contactHref = lp(getContactHref({ inquiry: "general", source: "opportunities" }));
  const maxwellHref = lp(siteRoutes.maxwellStudio);

  const { ref: areasRef, isVisible: areasVisible } = useRevealOnView<HTMLElement>({ threshold: 0.12 });

  return (
    <>
      {/* Hero — framed box, text + sphere split by a divider line */}
      <section className="opp-hero" aria-labelledby="opp-title">
        <div className="opp-hero-frame">
          <div className="opp-hero-grid">
            <div className="opp-hero-text">
              <h1 id="opp-title" className="opp-display">
                <span className="dim">Four ways to be part of the</span>{" "}
                <span className="opp-accent">Noon</span> ecosystem.
              </h1>
              <p className="opp-lead opp-hero-lead">
                Noon is building more than a services firm. Investors, sellers, developers and partners
                each have a distinct entry point — structured, practical, and open to the right people.
              </p>
              <div className="opp-hero-actions">
                <a href="#opp-tracks" className="opp-btn opp-btn-primary">
                  Look at options
                </a>
              </div>
            </div>
            <div className="opp-hero-globe" aria-hidden>
              <EcosystemGlobe />
            </div>
          </div>
        </div>
      </section>

      {/* Areas — the four entry points, hairline cell grid */}
      <section className="opp-section" id="opp-tracks" ref={areasRef}>
        <div className={`opp-sechead opp-reveal ${areasVisible ? "in-view" : ""}`}>
          <h2 className="opp-h2">Four ways to work with Noon</h2>
          <p className="opp-lead">
            Each path uses the same contact route. The category just tells Noon which conversation to
            start from.
          </p>
        </div>

        <div className={`opp-areas-grid opp-reveal ${areasVisible ? "in-view" : ""}`}>
          {AREAS.map((area) => {
            const { Icon } = area;
            // TODO(owner): per-area destination — currently all route to the
            // shared contact intake; swap for area-specific hrefs when provided.
            const href = area.href ?? contactHref;
            return (
              <Link className="opp-area" key={area.title} href={href}>
                <div className="opp-area-head">
                  <h3 className="opp-area-title">{area.title}</h3>
                  <span className="opp-area-icon" aria-hidden>
                    <Icon size={17} strokeWidth={1.75} />
                  </span>
                </div>
                <p className="opp-area-desc">{area.description}</p>
                <div className="opp-area-foot">
                  <span className="opp-area-cta">
                    See details
                    <ArrowRight className="ic" size={15} strokeWidth={2} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="opp-section" style={{ paddingTop: 0 }}>
        <div className="opp-cta">
          <h2 className="opp-h2">Ready to build?</h2>
          <p className="opp-cta-copy">Start a conversation with Maxwell, or reach out directly.</p>
          <div className="opp-cta-actions">
            <Link href={contactHref} className="opp-btn opp-btn-primary">
              Contact Noon
              <ArrowRight className="ic" size={16} strokeWidth={2} />
            </Link>
            <Link href={maxwellHref} className="opp-btn opp-btn-secondary">
              Start with Maxwell
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
