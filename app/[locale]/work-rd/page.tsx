import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ArrowRight } from "lucide-react";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { siteRoutes, getContactHref, getStartWithMaxwellHref } from "@/lib/site-config";
import "./work-rd.css";

export const metadata: Metadata = {
  title: "Work (redesign) | Noon",
  robots: { index: false },
};

const STATS = [
  { value: "11", label: "sectors shipped" },
  { value: "100%", label: "human-reviewed" },
  { value: "Yours", label: "code & IP" },
];

function Ticks() {
  return (
    <>
      {(["tl", "tr", "bl", "br"] as const).map((p) => (
        <span key={p} className={`wr-tick ${p}`} aria-hidden>
          <svg viewBox="0 0 11 11"><path d="M5.5 0V11M0 5.5H11" stroke="currentColor" strokeWidth="1" /></svg>
        </span>
      ))}
    </>
  );
}

type Props = { params: Promise<{ locale: string }> };

export default async function WorkRedesignPage({ params }: Props) {
  const { locale } = await params;
  const lp = (href: string) => `/${locale}${href}`;
  const contactHref = lp(getContactHref({ inquiry: "new-project", source: "work" }));
  const maxwellHref = lp(getStartWithMaxwellHref());

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} work-rd`}>
      {/* nav */}
      <header className="wr-nav">
        <div className="wr-nav-inner">
          <Link href={lp(siteRoutes.home)} className="wr-nav-logo" aria-label="Noon — home">
            <span style={{ height: 20, display: "inline-flex" }}><NoonWordmark /></span>
          </Link>
          <nav className="wr-nav-links">
            <Link href={lp(siteRoutes.services)}>Services</Link>
            <Link href={lp(siteRoutes.about)}>About</Link>
            <Link href={lp(siteRoutes.contact)}>Contact</Link>
          </nav>
          <Link href={maxwellHref} className="wr-nav-cta wr-btn wr-btn-primary wr-btn-sm">
            Start with Maxwell
          </Link>
        </div>
      </header>

      <main className="wr-wrap">
        {/* hero */}
        <section className="wr-hero">
          <p className="wr-kicker">/ Selected work</p>
          <h1 className="wr-display" style={{ marginTop: 18 }}>Real software, shipped and reviewed.</h1>
          <p className="wr-lead wr-hero-lead">
            Internal platforms, product rebuilds, AI integrations, and audits — across industries.
            Every build accelerated by AI and reviewed by senior engineers, line by line.
          </p>
          <div className="wr-hero-actions">
            <Link href={contactHref} className="wr-btn wr-btn-primary">Start a project <ArrowRight size={15} /></Link>
            <Link href={lp("/approach")} className="wr-btn wr-btn-secondary">How we work</Link>
          </div>
        </section>

        {/* stat band — technical grid */}
        <section className="wr-section" style={{ paddingTop: 0 }}>
          <div className="wr-statband wr-tickframe">
            <Ticks />
            <div className="wr-statgrid">
              {STATS.map((s) => (
                <div key={s.label} className="wr-stat">
                  <div className="v">{s.value}</div>
                  <div className="l">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
