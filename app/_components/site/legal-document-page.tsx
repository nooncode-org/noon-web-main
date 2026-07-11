import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SiteNavRd } from "@/app/_components/site/site-nav-rd";
import { SiteFooterRd } from "@/app/_components/site/site-footer-rd";
import { getContactHref } from "@/lib/site-config";
import "./legal-rd.css";
import "./site-footer-rd.css";

export type LegalDocumentDetail = {
  label: string;
  value: string;
  href?: string;
};

export type LegalDocumentSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  summary: string;
  subtitle?: string;
  overview?: string[];
  details: LegalDocumentDetail[];
  sections: LegalDocumentSection[];
};

type LegalDocumentPageProps = {
  document: LegalDocument;
  locale?: string;
};

function toSectionId(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * LegalDocumentPage — REDESIGN (.lgl-rd). Renders every legal document
 * (privacy-policy, terms-and-conditions, cookies-policy, legal-notice) from
 * structured data. Chrome (nav, decorative frame, shared footer) mirrors the
 * other redesigned pages; only the data-driven body differs per document.
 */
export function LegalDocumentPage({ document, locale = "en" }: LegalDocumentPageProps) {
  const lp = (href: string) => (href.startsWith("/") ? `/${locale}${href}` : href);
  const contactHref = lp(getContactHref("legal"));

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd`}>
      <SiteNavRd locale={locale} />

      <div className="lgl-frame" aria-hidden />

      <main className="lgl-wrap">
        {/* hero */}
        <section className="lgl-hero">
          <div className="lgl-hero-inner">
            <p className="lgl-kicker">Legal</p>
            <h1 className="lgl-display">{document.title}</h1>
            <div className="lgl-lead">
              {document.subtitle ? <p>{document.subtitle}</p> : null}
              <p>{document.summary}</p>
            </div>
            <div className="lgl-hero-actions">
              <Link href={contactHref} className="lgl-btn lgl-btn-secondary">
                Contact Noon
              </Link>
            </div>
          </div>
        </section>

        {/* details sidebar + article */}
        <section className="lgl-section" style={{ paddingTop: 0 }}>
          <div className="lgl-doc-grid">
            <aside className="lgl-aside">
              <div className="lgl-card">
                <p className="lgl-card-label">Document details</p>
                <dl>
                  {document.details.map((detail) => (
                    <div className="lgl-detail" key={`${detail.label}-${detail.value}`}>
                      <dt className="lgl-detail-dt">{detail.label}</dt>
                      <dd className="lgl-detail-dd">
                        {detail.href ? <a href={detail.href}>{detail.value}</a> : detail.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="lgl-card lgl-toc-card">
                <p className="lgl-card-label">On this page</p>
                <nav aria-label={`${document.title} sections`}>
                  <ul className="lgl-toc">
                    {document.sections.map((section) => (
                      <li key={section.title}>
                        <a href={`#${toSectionId(section.title)}`}>{section.title}</a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            </aside>

            <article>
              {document.overview?.length ? (
                <div className="lgl-overview">
                  <p className="lgl-card-label">Overview</p>
                  <div className="lgl-prose">
                    {document.overview.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              ) : null}

              {document.sections.map((section) => (
                <section id={toSectionId(section.title)} key={section.title} className="lgl-sec">
                  <h2 className="lgl-h2">{section.title}</h2>
                  <div className="lgl-prose">
                    {section.paragraphs?.length
                      ? section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
                      : null}
                    {section.bullets?.length ? (
                      <ul>
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </section>
              ))}
            </article>
          </div>
        </section>
      </main>

      <SiteFooterRd />
    </div>
  );
}
