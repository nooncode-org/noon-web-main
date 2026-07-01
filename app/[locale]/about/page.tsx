import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { AboutContentRd } from "./about-content-rd";
import { siteRoutes, getStartWithMaxwellHref } from "@/lib/site-config";
import { SiteFooterRd } from "@/app/_components/site/site-footer-rd";
import "./about-rd.css";
import "@/app/_components/site/site-footer-rd.css";

export const metadata: Metadata = {
  title: "About | Noon",
  description:
    "A technology development company built around real delivery. We define exactly what to build, build it, and deliver it in code you own.",
};

export default function AboutPage() {
  const maxwellHref = getStartWithMaxwellHref();

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} abt-rd`}>
      {/* nav */}
      <header className="abt-nav">
        <div className="abt-nav-inner">
          <Link href={siteRoutes.home} className="abt-nav-logo" aria-label="Noon — home">
            <span style={{ height: 20, display: "inline-flex" }}>
              <NoonWordmark />
            </span>
          </Link>
          <nav className="abt-nav-links">
            <Link href={siteRoutes.services}>Services</Link>
            <Link href="/work">Work</Link>
            <Link href={siteRoutes.about} className="active">About</Link>
            <Link href={siteRoutes.contact}>Contact</Link>
          </nav>
          <Link href={maxwellHref} className="abt-btn abt-btn-primary abt-btn-sm">
            Start with Maxwell
          </Link>
        </div>
      </header>

      {/* framed page border */}
      <div className="abt-frame" aria-hidden />

      <AboutContentRd />

      {/* footer — shared across redesign pages */}
      <SiteFooterRd />
    </div>
  );
}
