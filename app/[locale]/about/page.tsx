import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { AboutContentRd } from "./about-content-rd";
import {
  siteRoutes,
  getStartWithMaxwellHref,
  footerLinkGroups,
  footerSocialLinks,
} from "@/lib/site-config";
import "./about-rd.css";

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

      {/* footer */}
      <footer className="abt-footer">
        <div className="abt-wrap">
          <div className="abt-footer-top">
            <div className="abt-footer-brand">
              <span style={{ height: 22, display: "inline-flex", color: "var(--text-primary)" }}>
                <NoonWordmark />
              </span>
              <p className="tag">
                Custom software and AI products — every build reviewed by a human, and the code is yours.
              </p>
            </div>
            <div className="abt-footer-col">
              <h4>Site</h4>
              <ul>
                {footerLinkGroups.Site.map((l) => (
                  <li key={l.name}>
                    <Link href={l.href ?? "/"}>{l.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="abt-footer-col">
              <h4>Legal</h4>
              <ul>
                {footerLinkGroups.Legal.map((l) => (
                  <li key={l.name}>
                    <Link href={l.href ?? "/"}>{l.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="abt-footer-col">
              <h4>Connect</h4>
              <ul>
                {footerSocialLinks.map((l) => (
                  <li key={l.name}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="abt-divider" style={{ marginTop: 44 }} />
        <div className="abt-wrap">
          <div className="abt-footer-bottom">
            <span className="abt-status">
              <span className="dot" />
              Every build, human-reviewed
            </span>
            <span className="abt-footer-copy">© 2026 Noon</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
