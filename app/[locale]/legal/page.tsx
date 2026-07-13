import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Shield, Cookie, Scale, ArrowRight } from "lucide-react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SiteNavRd } from "@/app/_components/site/site-nav-rd";
import { SiteFooterRd } from "@/app/_components/site/site-footer-rd";
import { siteRoutes } from "@/lib/site-config";
import "@/app/_components/site/legal-rd.css";
import "@/app/_components/site/site-footer-rd.css";

export const metadata: Metadata = {
  title: "Legal | Noon",
  description: "Legal documents, policies, and compliance information.",
  alternates: { canonical: "/en/legal" },
};

const legalDocs = [
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    description: "How we collect, use, and protect your data",
    icon: Shield,
    updated: "March 31, 2026",
  },
  {
    slug: "terms-and-conditions",
    title: "Terms & Conditions",
    description: "Rules for using our services",
    icon: FileText,
    updated: "March 31, 2026",
  },
  {
    slug: "cookies-policy",
    title: "Cookies Policy",
    description: "How we use cookies and tracking",
    icon: Cookie,
    updated: "March 31, 2026",
  },
  {
    slug: "legal-notice",
    title: "Legal Notice",
    description: "Company information and disclaimers",
    icon: Scale,
    updated: "March 31, 2026",
  },
];

type LegalPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LegalPage({ params }: LegalPageProps) {
  const { locale } = await params;
  const lp = (href: string) => `/${locale}${href}`;

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd`}>
      <SiteNavRd locale={locale} />

      <div className="lgl-frame" aria-hidden />

      <main className="lgl-wrap">
        {/* hero */}
        <section className="lgl-hero">
          <div className="lgl-hero-inner">
            <p className="lgl-kicker">Legal</p>
            <h1 className="lgl-display">Legal documents</h1>
            <div className="lgl-lead">
              <p>The policies and terms that govern how Noon works with you — and how we handle your data.</p>
            </div>
          </div>
        </section>

        {/* document grid */}
        <section className="lgl-section" style={{ paddingTop: 0 }}>
          <div className="lgl-index-grid">
            {legalDocs.map((doc) => {
              const Icon = doc.icon;
              return (
                <Link key={doc.slug} href={lp(`/${doc.slug}`)} className="lgl-doc-card">
                  <span className="lgl-doc-icon">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <span className="lgl-doc-title">{doc.title}</span>
                  <span className="lgl-doc-desc">{doc.description}</span>
                  <span className="lgl-doc-meta">
                    <span className="lgl-doc-updated">Updated {doc.updated}</span>
                    <ArrowRight className="lgl-doc-arrow" size={16} strokeWidth={1.75} />
                  </span>
                </Link>
              );
            })}
          </div>

          {/* contact */}
          <div className="lgl-contact">
            <h2 className="lgl-h3">Questions about any of this?</h2>
            <p className="lgl-contact-copy">
              Write to us at{" "}
              <a href="mailto:noon.message@gmail.com">noon.message@gmail.com</a> — Wilmington,
              Delaware, United States.
            </p>
            <div className="lgl-contact-actions">
              <Link href={lp(siteRoutes.contact)} className="lgl-btn lgl-btn-primary">
                Contact Noon
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooterRd />
    </div>
  );
}
