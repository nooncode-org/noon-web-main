import { Link } from "@/lib/navigation";
import { getTranslations } from "next-intl/server";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { footerLinkGroups, footerSocialLinks } from "@/lib/site-config";

/**
 * Shared footer for the redesigned pages (contact, work, templates, about).
 *
 * Single source of truth: every redesign page renders this exact markup, styled
 * by the `.rdf-*` rules in `site-footer-rd.css`. Those styles are token-based
 * (`var(--border)`, `var(--mono)`, …) so they inherit each page's scoped design
 * tokens — the footer looks identical across pages without duplicating CSS.
 *
 * Internal links use next-intl's locale-aware `Link` (auto-prefixes the current
 * locale), so no `locale` prop is needed and it works on sync pages too.
 *
 * Uses its OWN fixed `.rdf-wrap` (1400px) rather than each host page's wrap, so
 * the footer renders IDENTICALLY on every page (the page wraps themselves are not
 * consistent — work is 1200px, about uses 24px padding, etc.). The full-bleed
 * divider spans the footer edge to edge.
 */
export async function SiteFooterRd() {
  // No locale prop: this footer is mounted by nine different pages, so it reads
  // the locale from the request rather than making each of them pass it.
  const t = await getTranslations("templatesPage");
  return (
    <footer className="rdf">
      <div className="rdf-wrap">
        <div className="rdf-top">
          <div className="rdf-brand">
            <span style={{ height: 22, display: "inline-flex", color: "var(--text-primary)" }}>
              <NoonWordmark />
            </span>
            <p className="rdf-tag">
              Custom software and AI products — every build reviewed by a human, and the code is yours.
            </p>
          </div>
          <div className="rdf-col">
            {/* h2, not h4: these label the footer's groups, and the page above
                ends anywhere from h1 to h3. Jumping to h4 skipped levels on
                every page that mounts this footer. Going UP a level never
                skips, so h2 is the one choice that is correct everywhere. */}
            <h2>{t("footerSite")}</h2>
            <ul>
              {footerLinkGroups.Site.map((l) => (
                <li key={l.name}>
                  <Link href={l.href ?? "/"}>{l.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rdf-col">
            <h2>{t("footerLegal")}</h2>
            <ul>
              {footerLinkGroups.Legal.map((l) => (
                <li key={l.name}>
                  <Link href={l.href ?? "/"}>{l.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rdf-col">
            <h2>{t("footerConnect")}</h2>
            <ul>
              {footerSocialLinks.map((l) => (
                <li key={l.name}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer">
                    {l.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="rdf-divider" style={{ marginTop: 44 }} />
      <div className="rdf-wrap">
        <div className="rdf-bottom">
          <span className="rdf-status">
            <span className="rdf-dot" />
            Every build, human-reviewed
          </span>
          <span className="rdf-copy">© 2026 Noon</span>
        </div>
      </div>
    </footer>
  );
}
