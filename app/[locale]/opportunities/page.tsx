import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { SiteFooterRd } from "@/app/_components/site/site-footer-rd";
import { siteRoutes, getStartWithMaxwellHref } from "@/lib/site-config";
import { OpportunitiesContent } from "./opportunities-content";
import "./opportunities-rd.css";
import "@/app/_components/site/site-footer-rd.css";

export const metadata: Metadata = {
  title: "Opportunities | Noon",
  description:
    "Four ways to be part of the Noon ecosystem — invest, sell, build, or partner. One contact route for every path.",
};

type Props = { params: Promise<{ locale: string }> };

// Server Component: renders the redesign chrome (nav, decorative frame, shared
// footer) around the client content island. Mirrors the other -rd pages.
export default async function OpportunitiesPage({ params }: Props) {
  const { locale } = await params;
  const lp = (href: string) => `/${locale}${href}`;
  const maxwellHref = lp(getStartWithMaxwellHref());

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} opp-rd`}>
      {/* nav */}
      <header className="opp-nav">
        <div className="opp-nav-inner">
          <Link href={lp(siteRoutes.home)} className="opp-nav-logo" aria-label="Noon — home">
            <span style={{ height: 20, display: "inline-flex" }}>
              <NoonWordmark />
            </span>
          </Link>
          <nav className="opp-nav-links">
            <Link href={lp(siteRoutes.services)}>Services</Link>
            <Link href={lp(siteRoutes.work)}>Work</Link>
            <Link href={lp(siteRoutes.about)}>About</Link>
            <Link href={lp(siteRoutes.contact)}>Contact</Link>
          </nav>
          <Link href={maxwellHref} className="opp-nav-cta opp-btn opp-btn-primary">
            Start with Maxwell
          </Link>
        </div>
      </header>

      <div className="opp-frame" aria-hidden />

      <main className="opp-wrap">
        <OpportunitiesContent />
      </main>

      <SiteFooterRd />
    </div>
  );
}
