import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SiteFooterRd } from "@/app/_components/site/site-footer-rd";
import { getStartWithMaxwellHref } from "@/lib/site-config";
import { OppNav } from "./opp-nav";
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
      <OppNav locale={locale} maxwellHref={maxwellHref} />

      <div className="opp-frame" aria-hidden />

      <main className="opp-wrap">
        <OpportunitiesContent />
      </main>

      <SiteFooterRd />
    </div>
  );
}
