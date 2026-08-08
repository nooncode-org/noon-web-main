"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { siteRoutes, getStartWithMaxwellHref } from "@/lib/site-config";
import "./site-nav-rd.css";

/**
 * The nav's copy, handed in rather than read from the message files.
 *
 * app/error.tsx mounts this component, and an error boundary renders OUTSIDE
 * the app's locale provider — React catches above it. A `useTranslations()`
 * call here therefore threw "context not found" and took the error page down
 * with it: the one screen whose entire job is to survive.
 *
 * Passing the strings in fixes that without giving up translation. The server
 * wrapper (site-nav.tsx) resolves them from the message files for every real
 * page; the error boundary supplies English, which is what it has.
 *
 * Required, not defaulted — a default would let a caller inside the provider
 * silently render English, which is precisely the failure this whole pass
 * exists to remove.
 */
export type SiteNavRdLabels = {
  /** Accessible name of the wordmark link — read aloud, never seen. */
  home: string;
};

type SiteNavRdProps = {
  locale: string;
  active?: "services" | "about" | "contact";
  /** Signed-in viewers get a studio nav: marketing links hidden, CTA → Studio. */
  signedIn?: boolean;
  labels: SiteNavRdLabels;
};

export function SiteNavRd({ locale, active, signedIn, labels }: SiteNavRdProps) {
  const [open, setOpen] = useState(false);
  const lp = (href: string) => `/${locale}${href}`;
  const maxwellHref = lp(getStartWithMaxwellHref());

  const links = [
    { href: lp(siteRoutes.services), label: "Services", key: "services" },
    { href: lp(siteRoutes.about), label: "About", key: "about" },
    { href: lp(siteRoutes.contact), label: "Contact", key: "contact" },
  ];

  // Signed-in: no marketing links / no "Start with Maxwell" sign-up CTA — just
  // the logo and a "Go to Studio" button (the studio's own nav lives inside).
  if (signedIn) {
    return (
      <header className="rdnav">
        <div className="rdnav-inner">
          <Link href={lp(siteRoutes.home)} className="rdnav-logo" aria-label={labels.home}>
            <span style={{ height: 20, display: "inline-flex" }}>
              <NoonWordmark />
            </span>
          </Link>
          <Link href={lp(siteRoutes.maxwellStudio)} className="rdnav-cta rdnav-cta-solo">
            Go to Studio
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="rdnav">
      <div className="rdnav-inner">
        <Link href={lp(siteRoutes.home)} className="rdnav-logo" aria-label={labels.home}>
          <span style={{ height: 20, display: "inline-flex" }}>
            <NoonWordmark />
          </span>
        </Link>
        <nav className="rdnav-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={active === l.key ? "active" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href={maxwellHref} className="rdnav-cta">
          Start with Maxwell
        </Link>
        <button
          type="button"
          className="rdnav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
        </button>
      </div>

      <div
        className={`rdnav-scrim${open ? " open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div className={`rdnav-mobile${open ? " open" : ""}`}>
        <nav className="rdnav-mobile-links">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={active === l.key ? "active" : undefined}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href={maxwellHref} className="rdnav-mobile-cta" onClick={() => setOpen(false)}>
          Start with Maxwell
        </Link>
      </div>
    </header>
  );
}
