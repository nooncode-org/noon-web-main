import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SiteNav } from "@/app/_components/site/site-nav";
import { getContactHref } from "@/lib/site-config";
import { resolveDisabledLocaleRedirect } from "@/i18n/launch-locales";
import "@/app/_components/site/legal-rd.css";
import "@/app/not-found.css";

/**
 * The 404 body, shared by the two files that can render it:
 *
 *   app/not-found.tsx          locale-less paths — English.
 *   app/[locale]/not-found.tsx anything under a locale — translated.
 *
 * It exists so those two never drift: a 404 is the page most likely to be
 * forgotten in a redesign, and the one a lost visitor judges the site by.
 */

export interface NotFoundViewProps {
  /** Drives the nav's links and the two CTAs below. */
  locale: string;
  kicker: string;
  headline: string;
  lead: string;
  backHome: string;
  contact: string;
}

/**
 * Point a link at where the visitor will actually LAND, not at where the
 * locale would suggest. `/es/contact` bounces to `/en/contact` (Spanish ships
 * only where every word is translated), and sending someone through a redirect
 * we can predict is just a slower way to arrive. Asking the gate itself keeps
 * this correct for free the day a page joins the allowlist.
 */
function landingHref(locale: string, pathAndQuery: string): string {
  const [path, query] = pathAndQuery.split("?");
  // "/" would otherwise prefix to "/en/" and cost a trailing-slash redirect.
  const prefixed = path === "/" ? `/${locale}` : `/${locale}${path}`;
  const final = resolveDisabledLocaleRedirect(prefixed) ?? prefixed;
  return query ? `${final}?${query}` : final;
}

export function NotFoundView({
  locale,
  kicker,
  headline,
  lead,
  backHome,
  contact,
}: NotFoundViewProps) {
  const contactHref = landingHref(
    locale,
    getContactHref({ inquiry: "general", source: "not-found" }),
  );

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd`}>
      <SiteNav locale={locale} />

      <div className="lgl-frame" aria-hidden />

      <main className="nf-main">
        <div className="nf-center">
          <p className="nf-kicker">{kicker}</p>
          {/* No manual line break: the headline is one sentence, and where it
              wraps is a typographic decision that differs per language.
              `text-wrap: balance` makes that decision in the browser. */}
          <h1 className="nf-display">{headline}</h1>
          <p className="nf-lead">{lead}</p>
          <div className="nf-actions">
            <Link
              href={landingHref(locale, "/")}
              className="lgl-btn lgl-btn-primary"
            >
              {backHome}
            </Link>
            <Link href={contactHref} className="lgl-btn lgl-btn-secondary">
              {contact}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
