import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SvcNav } from "./svc-nav";
import { ServicesContent } from "./services-content";
import { SiteFooterRd } from "@/app/_components/site/site-footer-rd";
import { getStartWithMaxwellHref } from "@/lib/site-config";
import "./services-rd.css";
import "@/app/_components/site/site-footer-rd.css";

export const metadata: Metadata = {
  title: "Services | Noon",
  description:
    "Four ways Noon helps teams move from problem to working software: custom development, upgrades, engineering support, and business technology audits — every build human-reviewed.",
  alternates: { canonical: "/en/services" },
};

// Service structured data — mirrors the four service summaries rendered by
// ServicesContent (keep in sync with its `services` array).
const SERVICES_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: [
    { name: "Custom Development", description: "New software built around your business logic, users, workflows, and operational constraints." },
    { name: "Upgrade", description: "Improve an existing website or product surface when the current version is underperforming, unclear, or dated." },
    { name: "Engineering Support", description: "Technical support capacity for software, hardware, infrastructure, and technology operations." },
    { name: "Business Technology Audit", description: "A diagnostic review of the business technology and operational setup before deciding what should change." },
  ].map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: { "@type": "Service", name: s.name, description: s.description, provider: { "@type": "Organization", name: "Noon" } },
  })),
};

type Props = { params: Promise<{ locale: string }> };

export default async function ServicesPage({ params }: Props) {
  const { locale } = await params;
  const lp = (href: string) => `/${locale}${href}`;
  const maxwellHref = lp(getStartWithMaxwellHref());

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} svc-rd`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SERVICES_JSON_LD) }}
      />
      <SvcNav locale={locale} maxwellHref={maxwellHref} />
      <div className="svc-frame" aria-hidden />

      <main>
        <ServicesContent />
      </main>

      <SiteFooterRd />
    </div>
  );
}
