import Link from "next/link";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { getContactHref, getStartWithMaxwellHref } from "@/lib/site-config";
import "@/app/_components/site/legal-rd.css";
import "./not-found.css";

export const metadata: Metadata = {
  title: "Page not found — Noon",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  const contactHref = `/en${getContactHref({ inquiry: "general", source: "not-found" })}`;
  const maxwellHref = `/en${getStartWithMaxwellHref()}`;

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd`}>
      {/* nav */}
      <header className="lgl-nav">
        <div className="lgl-nav-inner">
          <Link href="/" className="lgl-nav-logo" aria-label="Noon — home">
            <span style={{ height: 20, display: "inline-flex" }}>
              <NoonWordmark />
            </span>
          </Link>
          <nav className="lgl-nav-links">
            <Link href="/en/services">Services</Link>
            <Link href="/en/about">About</Link>
            <Link href="/en/contact">Contact</Link>
          </nav>
          <Link href={maxwellHref} className="lgl-nav-cta lgl-btn lgl-btn-primary">
            Start with Maxwell
          </Link>
        </div>
      </header>

      <div className="lgl-frame" aria-hidden />

      <main className="nf-main">
        <div className="nf-center">
          <p className="nf-kicker">404 — Not found</p>
          <h1 className="nf-display">We couldn&apos;t find<br />that page.</h1>
          <p className="nf-lead">
            The link may be old, or the page may have moved. Go back to the home page or reach out if you were looking for something specific.
          </p>
          <div className="nf-actions">
            <Link href="/" className="lgl-btn lgl-btn-primary">
              Back to home
            </Link>
            <Link href={contactHref} className="lgl-btn lgl-btn-secondary">
              Contact Noon
            </Link>
          </div>
        </div>
      </main>

      <footer className="nf-footer">
        <span>© 2026 Noon</span>
      </footer>
    </div>
  );
}
