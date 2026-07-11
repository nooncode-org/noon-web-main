"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { siteRoutes } from "@/lib/site-config";

type OppNavProps = { locale: string; maxwellHref: string };

// Client nav for the Opportunities -rd page: desktop keeps the inline links +
// CTA; below 768 they collapse behind a hamburger that opens a top drawer with
// the links and the primary CTA. Mirrors the -rd nav styling (opp-nav-*).
export function OppNav({ locale, maxwellHref }: OppNavProps) {
  const [open, setOpen] = useState(false);
  const lp = (href: string) => `/${locale}${href}`;
  const links = [
    { href: lp(siteRoutes.services), label: "Services" },
    { href: lp(siteRoutes.about), label: "About" },
    { href: lp(siteRoutes.contact), label: "Contact" },
  ];

  return (
    <header className="opp-nav">
      <div className="opp-nav-inner">
        <Link href={lp(siteRoutes.home)} className="opp-nav-logo" aria-label="Noon — home">
          <span style={{ height: 20, display: "inline-flex" }}>
            <NoonWordmark />
          </span>
        </Link>
        <nav className="opp-nav-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href={maxwellHref} className="opp-nav-cta opp-btn opp-btn-primary">
          Start with Maxwell
        </Link>
        <button
          type="button"
          className="opp-nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
        </button>
      </div>

      <div
        className={`opp-nav-scrim ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div className={`opp-nav-mobile ${open ? "open" : ""}`}>
        <nav className="opp-nav-mobile-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href={maxwellHref}
          className="opp-btn opp-btn-primary opp-nav-mobile-cta"
          onClick={() => setOpen(false)}
        >
          Start with Maxwell
        </Link>
      </div>
    </header>
  );
}
