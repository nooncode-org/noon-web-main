import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { auth } from "@/auth";
import { TemplatesContent } from "./templates-content";
import { SiteNav } from "@/app/_components/site/site-nav";
import { ProposalSidebar } from "@/components/maxwell/proposal-sidebar";
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
  const [{ locale }, session] = await Promise.all([params, auth()]);
  const viewerEmail = session?.user?.email ?? null;

  // Signed in → the catalog inside the app shell, same rule as the home and
  // /upgrade: the rail instead of the marketing nav, no viewport frame, no
  // footer, and no pitch around the grid. Reaching this page from the rail's
  // "Templates" and landing back in marketing chrome was the seam being closed.
  //
  // Cost of the auth() call: this page stops being statically rendered. Accepted
  // — the home already pays it, the catalog is local data (no DB round-trip), and
  // crawlers still get the full marketing HTML since they arrive signed out.
  if (viewerEmail) {
    return (
      <div
        className={`${GeistSans.variable} ${GeistMono.variable} tpl-rd flex h-[100dvh] overflow-hidden bg-background`}
      >
        <ProposalSidebar
          viewerEmail={viewerEmail}
          locale={locale}
          collapsibleRail
          accountSettings
        />

        <div className="min-w-0 flex-1 overflow-y-auto">
          <TemplatesContent tool />
        </div>
      </div>
    );
  }

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
