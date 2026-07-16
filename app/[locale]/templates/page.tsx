import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TemplatesContent } from "./templates-content";
import { SiteNav } from "@/app/_components/site/site-nav";
import { SiteFooterRd } from "@/app/_components/site/site-footer-rd";
import "./templates-rd.css";
import "@/app/_components/site/site-footer-rd.css";

export const metadata: Metadata = {
  title: "Templates | Noon",
  description:
    "Starting points for real software builds — each template is a pre-defined scope for a common software type, adapted to your business.",
  alternates: { canonical: "/en/templates" },
};

type Props = { params: Promise<{ locale: string }> };

export default async function TemplatesPage({ params }: Props) {
  const { locale } = await params;

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} tpl-rd`}>
      <SiteNav locale={locale} />

      {/* framed page border */}
      <div className="tpl-frame" aria-hidden />

      <TemplatesContent />

      {/* footer — shared across redesign pages */}
      <SiteFooterRd />
    </div>
  );
}
