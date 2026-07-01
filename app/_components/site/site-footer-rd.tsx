import { Link } from "@/lib/navigation";
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
export function SiteFooterRd() {
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
            <h4>Site</h4>
            <ul>
              {footerLinkGroups.Site.map((l) => (
                <li key={l.name}>
                  <Link href={l.href ?? "/"}>{l.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rdf-col">
            <h4>Legal</h4>
            <ul>
              {footerLinkGroups.Legal.map((l) => (
                <li key={l.name}>
                  <Link href={l.href ?? "/"}>{l.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rdf-col">
            <h4>Connect</h4>
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
