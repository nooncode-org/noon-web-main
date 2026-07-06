import type { Metadata } from "next";
import { SitePageFrame } from "@/app/_components/site/site-page-frame";
import { ServicesContent } from "./services-content";

export const metadata: Metadata = {
  title: "Services | Noon",
  description:
    "Custom development, upgrades, engineering support, and business technology audits — four ways Noon builds and improves software.",
  alternates: { canonical: "/en/services" },
};

// Service structured data — mirrors the four service summaries rendered by
// ServicesContent (keep in sync with its `services` array). Provider stays a
// minimal Organization reference; the full Organization schema lives in the
// root layout.
const SERVICES_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: [
    {
      name: "Custom Development",
      description:
        "New software built around your business logic, users, workflows, and operational constraints.",
    },
    {
      name: "Upgrade",
      description:
        "Improve an existing website or product surface when the current version is underperforming, unclear, or dated.",
    },
    {
      name: "Engineering Support",
      description:
        "Technical support capacity for software, hardware, infrastructure, and technology operations.",
    },
    {
      name: "Business Technology Audit",
      description:
        "A diagnostic review of the business technology and operational setup before deciding what should change.",
    },
  ].map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "Service",
      name: s.name,
      description: s.description,
      provider: { "@type": "Organization", name: "Noon" },
    },
  })),
};

// Server Component wrapper: renders the auth-aware chrome (`SitePageFrame`
// fetches the viewer server-side) and mounts the client page body as an
// island. Keeping `SitePageFrame` out of the client graph is what lets the
// user menu (avatar) resolve instead of falling back to the "Sign up" CTA.
export default function ServicesPage() {
  return (
    <SitePageFrame>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SERVICES_JSON_LD) }}
      />
      <ServicesContent />
    </SitePageFrame>
  );
}
