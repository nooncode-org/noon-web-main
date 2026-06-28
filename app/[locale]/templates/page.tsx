import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { TemplatesContent } from "./templates-content";
import {
  siteRoutes,
  getStartWithMaxwellHref,
  footerLinkGroups,
  footerSocialLinks,
} from "@/lib/site-config";
import "./templates-rd.css";

export const metadata: Metadata = {
  title: "Templates | Noon",
  description:
    "Starting points for real software builds — each template is a pre-defined scope for a common software type, adapted to your business.",
};

export default function TemplatesPage() {
  const maxwellHref = getStartWithMaxwellHref();

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} tpl-rd`}>
      {/* nav — locale-agnostic links; next-intl middleware handles locale prefix */}
      <header className="tpl-nav">
        <div className="tpl-nav-inner">
          <Link href={siteRoutes.home} className="tpl-nav-logo" aria-label="Noon — home">
            <span style={{ height: 20, display: "inline-flex" }}>
              <NoonWordmark />
            </span>
          </Link>
          <nav className="tpl-nav-links">
            <Link href={siteRoutes.services}>Services</Link>
            <Link href="/work">Work</Link>
            <Link href={siteRoutes.about}>About</Link>
            <Link href={siteRoutes.contact}>Contact</Link>
          </nav>
          <Link href={maxwellHref} className="tpl-btn tpl-btn-primary tpl-btn-sm">
            Start with Maxwell
          </Link>
        </div>
      </header>

      {/* framed page border */}
      <div className="tpl-frame" aria-hidden />

      <TemplatesContent />

      {/* footer */}
      <footer className="tpl-footer">
        <div className="tpl-wrap">
          <div className="tpl-footer-top">
            <div className="tpl-footer-brand">
              <span style={{ height: 22, display: "inline-flex", color: "var(--text-primary)" }}>
                <NoonWordmark />
              </span>
              <p className="tag">
                Custom software and AI products — every build reviewed by a human, and the code is yours.
              </p>
            </div>
            <div className="tpl-footer-col">
              <h4>Site</h4>
              <ul>
                {footerLinkGroups.Site.map((l) => (
                  <li key={l.name}>
                    <Link href={l.href ?? "/"}>{l.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="tpl-footer-col">
              <h4>Legal</h4>
              <ul>
                {footerLinkGroups.Legal.map((l) => (
                  <li key={l.name}>
                    <Link href={l.href ?? "/"}>{l.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="tpl-footer-col">
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
        <div className="tpl-divider" style={{ marginTop: 44 }} />
        <div className="tpl-wrap">
          <div className="tpl-footer-bottom">
            <span className="tpl-status">
              <span className="dot" />
              Every build, human-reviewed
            </span>
            <span className="tpl-footer-copy">© 2026 Noon</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
