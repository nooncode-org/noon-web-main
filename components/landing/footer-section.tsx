"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { footerSocialLinks, siteRoutes } from "@/lib/site-config";
import { NoonLogo } from "@/components/ui/noon-logo";

const LOCALES = ["en", "es", "fr", "de"];

type FooterT = {
  tagline: string;
  rights: string;
  groups: { main: string; more: string; legal: string };
  links: {
    services: string;
    upgrade: string;
    templates: string;
    opportunities: string;
    about: string;
    contact: string;
    privacyPolicy: string;
    termsAndConditions: string;
    cookiesPolicy: string;
    legalNotice: string;
  };
};

const FOOTER_T: Record<string, FooterT> = {
  en: {
    tagline: "From idea to production. Every project ships as real, working software you own.",
    rights: "2026 Noon. All rights reserved.",
    groups: { main: "Main", more: "More", legal: "Legal" },
    links: {
      services: "Services",
      upgrade: "Upgrade",
      templates: "Templates",
      opportunities: "Opportunities",
      about: "About",
      contact: "Contact",
      privacyPolicy: "Privacy Policy",
      termsAndConditions: "Terms and Conditions",
      cookiesPolicy: "Cookies Policy",
      legalNotice: "Legal Notice",
    },
  },
  es: {
    tagline: "De la idea a produccion. Cada proyecto se entrega como software real y funcional que tu posees.",
    rights: "2026 Noon. Todos los derechos reservados.",
    groups: { main: "Principal", more: "Mas", legal: "Legal" },
    links: {
      services: "Servicios",
      upgrade: "Upgrade",
      templates: "Plantillas",
      opportunities: "Oportunidades",
      about: "Nosotros",
      contact: "Contacto",
      privacyPolicy: "Politica de privacidad",
      termsAndConditions: "Terminos y condiciones",
      cookiesPolicy: "Politica de cookies",
      legalNotice: "Aviso legal",
    },
  },
  fr: {
    tagline: "De l'idee a la production. Chaque projet est livre en logiciel reel et fonctionnel que vous possedez.",
    rights: "2026 Noon. Tous droits reserves.",
    groups: { main: "Principal", more: "Plus", legal: "Legal" },
    links: {
      services: "Services",
      upgrade: "Upgrade",
      templates: "Modeles",
      opportunities: "Opportunites",
      about: "A propos",
      contact: "Contact",
      privacyPolicy: "Politique de confidentialite",
      termsAndConditions: "Conditions generales",
      cookiesPolicy: "Politique de cookies",
      legalNotice: "Mentions legales",
    },
  },
  de: {
    tagline: "Von der Idee zur Produktion. Jedes Projekt wird als echte, funktionierende Software geliefert, die Ihnen gehort.",
    rights: "2026 Noon. Alle Rechte vorbehalten.",
    groups: { main: "Main", more: "Mehr", legal: "Rechtliches" },
    links: {
      services: "Dienste",
      upgrade: "Upgrade",
      templates: "Vorlagen",
      opportunities: "Opportunities",
      about: "Uber uns",
      contact: "Kontakt",
      privacyPolicy: "Datenschutzrichtlinie",
      termsAndConditions: "Allgemeine Geschaeftsbedingungen",
      cookiesPolicy: "Cookie-Richtlinie",
      legalNotice: "Impressum",
    },
  },
};

export function FooterSection() {
  const params = useParams();
  const pathname = usePathname();
  const paramLocale = typeof params?.locale === "string" ? params.locale : null;
  const pathLocale = LOCALES.find((locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`);
  const locale = (paramLocale && LOCALES.includes(paramLocale) ? paramLocale : pathLocale) ?? "en";
  const t = FOOTER_T[locale] ?? FOOTER_T.en;

  const lp = (href: string) => {
    if (href.startsWith("http") || href.startsWith("//")) return href;
    return `/${locale}${href}`;
  };

  const mainLinks = [
    { name: t.links.services, href: lp(siteRoutes.services) },
    { name: t.links.upgrade, href: lp(siteRoutes.upgrade) },
    { name: t.links.about, href: lp(siteRoutes.about) },
    { name: t.links.contact, href: lp(siteRoutes.contact) },
  ];

  const moreLinks = [
    { name: t.links.templates, href: lp(siteRoutes.templates) },
    { name: t.links.opportunities, href: lp(siteRoutes.opportunities) },
  ];

  const legalLinks = [
    { name: t.links.privacyPolicy, href: lp(siteRoutes.privacyPolicy) },
    { name: t.links.termsAndConditions, href: lp(siteRoutes.termsAndConditions) },
    { name: t.links.cookiesPolicy, href: lp(siteRoutes.cookiesPolicy) },
    { name: t.links.legalNotice, href: lp(siteRoutes.legalNotice) },
  ];

  return (
    <footer className="relative z-10 isolate overflow-hidden border-t border-foreground/10 bg-background">
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, rgba(18,0,197,0.35) 40%, rgba(106,99,242,0.25) 60%, transparent 100%)",
        }}
      />
      <div className="site-shell relative z-10 py-8 lg:py-9">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <Link href={lp(siteRoutes.home)} className="mb-4 inline-flex items-center">
              <NoonLogo variant="wordmark" height={28} />
            </Link>

            <p className="max-w-[22rem] text-sm leading-relaxed text-muted-foreground">{t.tagline}</p>

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
              {footerSocialLinks.map((link) =>
                link.href ? (
                  <a
                    key={link.name}
                    href={link.href}
                    className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.name}
                    <ArrowUpRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </a>
                ) : (
                  <span key={link.name} className="text-sm text-muted-foreground">
                    {link.name}
                  </span>
                )
              )}
            </div>
          </div>

          <nav className="grid grid-cols-2 gap-10 sm:gap-16 lg:min-w-[420px]" aria-label="Footer">
            <div>
              <h3 className="mb-4 text-sm font-medium text-foreground">{t.groups.main}</h3>
              <ul className="space-y-3">
                {mainLinks.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-medium text-foreground">{t.groups.more}</h3>
              <ul className="space-y-3">
                {moreLinks.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-foreground/10 pt-5 md:flex-row md:items-center md:justify-between">
          <p className="text-sm leading-none text-muted-foreground">{t.rights}</p>

          <nav aria-label={t.groups.legal}>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {legalLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
