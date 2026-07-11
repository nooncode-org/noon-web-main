import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { TemplatesContent } from "./templates-content";
import { siteRoutes, getStartWithMaxwellHref } from "@/lib/site-config";
import { SiteFooterRd } from "@/app/_components/site/site-footer-rd";
import "./templates-rd.css";
import "@/app/_components/site/site-footer-rd.css";

export const metadata: Metadata = {
  title: "Templates | Noon",
  description:
    "Starting points for real software builds — each template is a pre-defined scope for a common software type, adapted to your business.",
  alternates: { canonical: "/en/templates" },
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

      {/* footer — shared across redesign pages */}
      <SiteFooterRd />
    </div>
  );
}
