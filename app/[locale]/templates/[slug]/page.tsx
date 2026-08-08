import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { auth } from "@/auth";
import { TemplateMockup } from "@/components/landing/explore-builds-section";
import { WorkShot } from "@/components/work/work-shot";
import { SiteNav } from "@/app/_components/site/site-nav";
import { ProposalSidebar } from "@/components/maxwell/proposal-sidebar";
import { SiteFooterRd } from "@/app/_components/site/site-footer-rd";
import templateMockups from "@/data/template-mockups.json";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Check, X } from "lucide-react";
import { templatesCatalog, RETIRED_TEMPLATE_SLUGS } from "@/data/templates";
import { getContactHref, getStartWithMaxwellHref, siteRoutes } from "@/lib/site-config";
import { routing } from "@/i18n/routing";
import "@/app/_components/site/legal-rd.css";
import "@/app/_components/site/site-footer-rd.css";
import "./template-detail-rd.css";

type TemplateDetailPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    templatesCatalog.map((template) => ({ locale, slug: template.slug }))
  );
}

export async function generateMetadata({ params }: TemplateDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const template = templatesCatalog.find((item) => item.slug === slug);

  if (!template) {
    return { title: "Template Not Found | Noon" };
  }

  return {
    title: `${template.name} | Noon Templates`,
    description: template.summary,
    alternates: { canonical: `/en/templates/${template.slug}` },
  };
}

export default async function TemplateDetailPage({ params }: TemplateDetailPageProps) {
  const [{ locale, slug }, session] = await Promise.all([params, auth()]);
  const viewerEmail = session?.user?.email ?? null;

  const redirectTo = RETIRED_TEMPLATE_SLUGS[slug];
  if (redirectTo) {
    redirect(`/${locale}/templates/${redirectTo}`);
  }

  const template = templatesCatalog.find((item) => item.slug === slug);
  if (!template) notFound();

  const t = await getTranslations({ locale, namespace: "templates.detail.cta" });
  const lp = (href: string) => `/${locale}${href}`;

  const mockups = templateMockups as Record<string, { src: string; w: number; h: number }>;
  const mockup = mockups[template.slug];

  const ctaPrimary = lp(getStartWithMaxwellHref(template.prompt));
  const ctaContact = lp(getContactHref({ inquiry: "templates", source: `template-${template.slug}` }));

  // The body of this page IS the spec — what the baseline includes, the typical
  // extensions, when it fits and when it doesn't, the live preview. A signed-in
  // client needs exactly that, so it's written once here and dropped into whichever
  // chrome applies below. Kept at its original indentation on purpose: re-indenting
  // 130 untouched lines would bury the actual change in the diff.
  const detail = (
      <main className={viewerEmail ? "td-main td-tool" : "td-main"}>
        <div className="td-wrap">

          {/* back */}
          <Link href={lp(siteRoutes.templates)} className="td-back">
            <ArrowLeft size={14} />
            All templates
          </Link>

          {/* ── hero WITH live mockup ── */}
          {mockup ? (
            <>
              <div className="td-hero-meta">
                <p className="td-category">{template.category}</p>
                <h1 className="td-title">{template.name}</h1>
                <p className="td-summary">{template.summary}</p>
                <div className="td-tags">
                  {template.bestFit.map((fit) => (
                    <span key={fit} className="td-tag">{fit}</span>
                  ))}
                </div>
                <div className="td-ctas">
                  <Link href={ctaPrimary} className="lgl-btn lgl-btn-primary">
                    Use this template
                  </Link>
                  <Link href={ctaContact} className="lgl-btn lgl-btn-secondary">
                    Contact Noon
                  </Link>
                </div>
              </div>

              <WorkShot
                frame={{
                  src: mockup.src,
                  title: `${template.name} — live product preview`,
                  w: mockup.w,
                  h: mockup.h,
                }}
              />
              <p className="td-mockup-caption">
                Illustrative preview of a build from this baseline — fictional data. Hover to
                interact; expand for full size.
              </p>
            </>
          ) : (
            /* ── hero WITHOUT live mockup (two-column) ── */
            <div className="td-hero-2col">
              <div className="td-preview">
                <TemplateMockup category={template.category} />
              </div>
              <div className="td-preview-info">
                <p className="td-category">{template.category}</p>
                <h1 className="td-title">{template.name}</h1>
                <p className="td-summary">{template.summary}</p>
                <div className="td-tags">
                  {template.bestFit.map((fit) => (
                    <span key={fit} className="td-tag">{fit}</span>
                  ))}
                </div>
                <div className="td-ctas">
                  <Link href={ctaPrimary} className="lgl-btn lgl-btn-primary">
                    Use this template
                  </Link>
                  <Link href={ctaContact} className="lgl-btn lgl-btn-secondary">
                    Contact Noon
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ── details grid ── */}
          <div className="td-section" style={{ marginTop: "clamp(48px, 5vw, 72px)" }}>
            <div className="td-grid">
              {/* Included */}
              <div className="td-cell">
                <p className="td-cell-title">{t("includedBaseline")}</p>
                <ul className="td-item-list">
                  {template.includes.map((item) => (
                    <li key={item} className="td-item">
                      <span className="td-item-icon"><Check size={14} /></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Extensions */}
              <div className="td-cell">
                <p className="td-cell-title">{t("typicalExtensions")}</p>
                <ul className="td-item-list">
                  {template.extensions.map((item) => (
                    <li key={item} className="td-item">
                      <span className="td-item-dot" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Best fit */}
              <div className="td-cell">
                <p className="td-cell-title">{t("bestFit")}</p>
                <div className="td-use">
                  <p className="td-use-label"><Check size={12} /> Use when</p>
                  <p className="td-use-text">{template.useWhen}</p>
                </div>
                <div className="td-use">
                  <p className="td-use-label"><X size={12} /> Not ideal when</p>
                  <p className="td-use-text">{template.notIdealWhen}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── promise ── */}
          <div className="td-promise">
            <p className="td-promise-label">{t("whatBaselineDelivers")}</p>
            <p className="td-promise-text">{template.baselinePromise}</p>
          </div>

          {/* ── CTA ── Marketing only. "Use this template" is already the hero's
              primary button and "Browse all templates" is the back link at the top,
              so signed in this block is a pitch assembled from actions the client
              already has in front of them. */}
          {!viewerEmail && (
          <div className="td-cta">
            <h2 className="td-cta-title">{t("headline")}</h2>
            <p className="td-cta-desc">{t("description")}</p>
            <div className="td-cta-actions">
              <Link href={ctaPrimary} className="lgl-btn lgl-btn-primary">
                {t("startWithMaxwell")}
              </Link>
              <Link href={lp(siteRoutes.templates)} className="lgl-btn lgl-btn-secondary">
                {t("browseAll")}
              </Link>
            </div>
          </div>
          )}

        </div>
      </main>
  );

  // Signed in → the app shell, same rule as the home, /upgrade, /templates and
  // /contact: the rail instead of the marketing nav, no viewport frame, no footer.
  // This was the last door that sent a client back to visitor mode — you'd browse
  // the catalog inside the app, click a card, and land in marketing chrome.
  //
  // "All templates" and "Use this template" both stay: the first goes to the
  // signed-in catalog, the second opens Maxwell seeded with this template's prompt.
  // They're the point of the page, not decoration.
  if (viewerEmail) {
    return (
      <div
        className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd flex h-[100dvh] overflow-hidden bg-background`}
      >
        <ProposalSidebar
          viewerEmail={viewerEmail}
          locale={locale}
          collapsibleRail
          accountSettings
        />

        <div className="min-w-0 flex-1 overflow-y-auto">{detail}</div>
      </div>
    );
  }

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd`}>
      <SiteNav locale={locale} />

      <div className="lgl-frame" aria-hidden />

      {detail}

      <SiteFooterRd />
    </div>
  );
}
