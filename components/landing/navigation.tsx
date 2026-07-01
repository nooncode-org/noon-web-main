"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, PanelRight, X } from "lucide-react";
import { getStartWithMaxwellHref, siteRoutes } from "@/lib/site-config";
import { siteTones } from "@/lib/site-tones";
import { NoonLogo } from "@/components/ui/noon-logo";
import { UserMenu, type UserMenuViewer } from "@/components/ui/user-menu";
import { signOutAction } from "@/lib/auth/signout-action";

const NAV_LABELS: Record<string, { services: string; work: string; about: string; contact: string; startWithMaxwell: string }> = {
  en: { services: "Services", work: "Work", about: "About", contact: "Contact", startWithMaxwell: "Start with Maxwell" },
  es: { services: "Servicios", work: "Proyectos", about: "Nosotros", contact: "Contacto", startWithMaxwell: "Empezar con Maxwell" },
  fr: { services: "Services", work: "Projets", about: "A propos", contact: "Contact", startWithMaxwell: "Commencer avec Maxwell" },
  de: { services: "Dienste", work: "Projekte", about: "Uber uns", contact: "Kontakt", startWithMaxwell: "Mit Maxwell starten" },
};

const LOCALES = ["en", "es", "fr", "de"];
const navigationTone = siteTones.brand;

export type NavigationProps = {
  /**
   * Server-fetched viewer (from `getAuthenticatedViewer` in the parent RSC).
   * When non-null, the "Sign up" CTA is replaced by a `UserMenu` (avatar +
   * email + Maxwell Studio link + Sign out). When null/undefined, the legacy
   * "Sign up" button renders. This lets the same component serve both
   * marketing pages (anonymous traffic) and authenticated post-signin pages.
   */
  viewer?: UserMenuViewer | null;
};

export function Navigation({ viewer = null }: NavigationProps = {}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const params = useParams();

  const paramLocale = typeof params?.locale === "string" ? params.locale : null;
  const pathLocale = LOCALES.find((locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`);
  const currentLocale = (paramLocale && LOCALES.includes(paramLocale) ? paramLocale : pathLocale) ?? "en";
  const navLabels = NAV_LABELS[currentLocale] ?? NAV_LABELS.en;

  const translatedNav = [
    { name: navLabels.services, href: siteRoutes.services, match: [siteRoutes.services, siteRoutes.upgrade] },
    { name: navLabels.work, href: siteRoutes.work, match: [siteRoutes.work] },
    { name: navLabels.about, href: siteRoutes.about, match: [siteRoutes.about] },
    { name: navLabels.contact, href: siteRoutes.contact, match: [siteRoutes.contact] },
  ];

  const localHref = (href: string) => {
    if (href.startsWith("http") || href.startsWith("//")) return href;
    return `/${currentLocale}${href}`;
  };

  const isActiveLink = (matches: string[]) =>
    matches.some((route) => pathname === route || pathname.endsWith(route) || pathname.includes(`${route}/`));

  return (
    <>
      {/* Navbar fijo en estado inicial: ancho completo, sin transformación
         al hacer scroll. Backdrop blur sutil + bg semitransparente para
         enmascarar el contenido que pasa por detrás al scrollear (sin
         volver al pill flotante anterior). */}
      <header className="fixed top-0 left-0 right-0 z-[60] bg-background">
        <nav className="w-full">
          <div className="relative flex h-[60px] items-center justify-between px-6 md:px-7">
            <Link href={localHref(siteRoutes.home)} className="flex items-center group">
              <NoonLogo variant="wordmark" height={20} />
            </Link>

            <div className="hidden md:flex items-center gap-9 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              {translatedNav.map((link) => (
                <Link
                  key={link.name}
                  href={localHref(link.href)}
                  className={`text-sm transition-colors duration-200 ${
                    isActiveLink(link.match) ? "text-foreground" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              {viewer ? (
                <UserMenu viewer={viewer} locale={currentLocale} />
              ) : (
                <Button
                  asChild
                  size="sm"
                  className="px-6"
                  style={{ borderRadius: "8px", boxShadow: `inset 0 0 0 1px ${navigationTone.border}` }}
                >
                  <Link href={localHref("/signin")}>Sign up</Link>
                </Button>
              )}
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden flex items-center justify-center w-8 h-8"
              aria-label="Toggle menu"
            >
              <PanelRight className="w-5 h-5" style={{ width: "22px", height: "22px" }} />
            </button>
          </div>
        </nav>
      </header>

      <div
        className={`md:hidden fixed inset-0 z-[998] transition-all duration-300 ${
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ backgroundColor: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)" }}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <div
        className={`md:hidden fixed top-1.5 right-1.5 bottom-1.5 z-[999] w-72 transition-all duration-300 ${
          isMobileMenuOpen ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-full pointer-events-none"
        }`}
      >
        <div className="h-full rounded-[10px] border border-foreground/10 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8">
            <Link href={localHref(siteRoutes.home)} className="flex items-center" onClick={() => setIsMobileMenuOpen(false)}>
              <NoonLogo variant="wordmark" height={24} />
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-center w-7 h-7 rounded-[6px] border border-foreground/10 bg-secondary/50 text-muted-foreground"
              aria-label="Close menu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-3 py-3">
            {translatedNav.map((link) => (
              <Link
                key={link.name}
                href={localHref(link.href)}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-3.5 rounded-[8px] text-base font-medium transition-colors duration-200 ${
                  isActiveLink(link.match) ? "bg-secondary/60" : "hover:bg-secondary/40 text-foreground/80"
                }`}
                style={{ color: isActiveLink(link.match) ? navigationTone.accent : undefined }}
              >
                {link.name}
                {isActiveLink(link.match) && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: navigationTone.accent }} />
                )}
              </Link>
            ))}
          </div>

          <div className="px-4 pb-4 pt-1 space-y-3">
            <Button
              asChild
              className="h-11 w-full rounded-[8px] text-sm font-medium"
            >
              <Link href={localHref(getStartWithMaxwellHref())} onClick={() => setIsMobileMenuOpen(false)}>
                {navLabels.startWithMaxwell}
              </Link>
            </Button>
            {viewer ? (
              <>
                <div className="rounded-[8px] border border-border/60 bg-secondary/30 px-3 py-2">
                  <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground/80">
                    Signed in as
                  </p>
                  <p
                    className="mt-0.5 truncate text-xs font-mono text-foreground"
                    title={viewer.email}
                  >
                    {viewer.email}
                  </p>
                </div>
                <form
                  action={signOutAction}
                  onSubmit={() => setIsMobileMenuOpen(false)}
                >
                  <button
                    type="submit"
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-border bg-background text-sm font-medium text-foreground/85 transition-colors hover:bg-secondary/60"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Button
                asChild
                variant="outline"
                className="h-11 w-full rounded-[8px] text-sm font-medium"
              >
                <Link href={localHref("/signin")} onClick={() => setIsMobileMenuOpen(false)}>
                  Sign up
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
