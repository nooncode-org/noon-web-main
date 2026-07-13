"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { siteRoutes } from "@/lib/site-config";

type SvcNavProps = { locale: string; maxwellHref: string };

// Client nav for the Services -rd page: desktop keeps the inline links + CTA;
// below 768 they collapse behind a hamburger that opens a top drawer. Mirrors
// the -rd nav styling (svc-nav-*). "Services" is the active link here.
export function SvcNav({ locale, maxwellHref }: SvcNavProps) {
  const [open, setOpen] = useState(false);
  const lp = (href: string) => `/${locale}${href}`;
  const links = [
    { href: lp(siteRoutes.services), label: "Services", active: true },
    { href: lp(siteRoutes.about), label: "About" },
    { href: lp(siteRoutes.contact), label: "Contact" },
  ];

  return (
    <header className="svc-nav">
      <div className="svc-nav-inner">
        <Link href={lp(siteRoutes.home)} className="svc-nav-logo" aria-label="Noon — home">
          <span style={{ height: 20, display: "inline-flex" }}>
            <NoonWordmark />
          </span>
        </Link>
        <nav className="svc-nav-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={l.active ? "active" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href={maxwellHref} className="svc-nav-cta svc-btn svc-btn-primary svc-btn-sm">
          Start with Maxwell
        </Link>
        <button
          type="button"
          className="svc-nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
        </button>
      </div>

      <div
        className={`svc-nav-scrim ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div className={`svc-nav-mobile ${open ? "open" : ""}`}>
        <nav className="svc-nav-mobile-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href={maxwellHref}
          className="svc-btn svc-btn-primary svc-nav-mobile-cta"
          onClick={() => setOpen(false)}
        >
          Start with Maxwell
        </Link>
      </div>
    </header>
  );
}
