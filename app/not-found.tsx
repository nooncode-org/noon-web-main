import Link from "next/link";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SiteNavRd } from "@/app/_components/site/site-nav-rd";
import { getContactHref } from "@/lib/site-config";
import "@/app/_components/site/legal-rd.css";
import "./not-found.css";

export const metadata: Metadata = {
  title: "Page not found — Noon",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  const contactHref = `/en${getContactHref({ inquiry: "general", source: "not-found" })}`;

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd`}>
      <SiteNavRd locale="en" />

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
