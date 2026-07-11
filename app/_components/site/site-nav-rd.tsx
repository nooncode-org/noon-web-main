"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { siteRoutes, getStartWithMaxwellHref } from "@/lib/site-config";
import "./site-nav-rd.css";

type SiteNavRdProps = {
  locale: string;
  active?: "services" | "about" | "contact";
};

export function SiteNavRd({ locale, active }: SiteNavRdProps) {
  const [open, setOpen] = useState(false);
  const lp = (href: string) => `/${locale}${href}`;
  const maxwellHref = lp(getStartWithMaxwellHref());

  const links = [
    { href: lp(siteRoutes.services), label: "Services", key: "services" },
    { href: lp(siteRoutes.about), label: "About", key: "about" },
    { href: lp(siteRoutes.contact), label: "Contact", key: "contact" },
  ];

  return (
    <header className="rdnav">
      <div className="rdnav-inner">
        <Link href={lp(siteRoutes.home)} className="rdnav-logo" aria-label="Noon — home">
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
