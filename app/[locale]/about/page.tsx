import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AboutContentRd } from "./about-content-rd";
import { SiteNavRd } from "@/app/_components/site/site-nav-rd";
import { SiteFooterRd } from "@/app/_components/site/site-footer-rd";
import "./about-rd.css";
import "@/app/_components/site/site-footer-rd.css";

export const metadata: Metadata = {
  title: "About | Noon",
  description:
    "A technology development company built around real delivery. We define exactly what to build, build it, and deliver it in code you own.",
  alternates: { canonical: "/en/about" },
};

type Props = { params: Promise<{ locale: string }> };

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} abt-rd`}>
      <SiteNavRd locale={locale} active="about" />

      {/* framed page border */}
      <div className="abt-frame" aria-hidden />

      <AboutContentRd />

      {/* footer — shared across redesign pages */}
      <SiteFooterRd />
    </div>
  );
}
