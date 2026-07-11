import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { auth } from "@/auth";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { UpgradeInput } from "@/components/upgrade/upgrade-input";
import { UpgradeSessionList } from "@/components/upgrade/upgrade-session-list";
import { listUserSessions } from "@/lib/upgrade/repositories";
import { UpgradeSteps } from "@/components/upgrade/upgrade-steps";
import { UpgradeBeforeAfter } from "@/components/upgrade/upgrade-before-after";
import { SiteFooterRd } from "@/app/_components/site/site-footer-rd";
import { siteRoutes, getStartWithMaxwellHref } from "@/lib/site-config";
import "./upgrade-rd.css";
import "@/app/_components/site/site-footer-rd.css";

export const metadata: Metadata = {
  title: "Upgrade Your Website | Noon",
  description:
    "Get an AI-powered audit of your website and a fully upgraded version, then bring it to life with Noon.",
  alternates: { canonical: "/en/upgrade" },
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ url?: string; mode?: string }>;
};

async function UpgradePageContent({ params, searchParams }: Props) {
  const [{ locale }, { url = "", mode = "" }, session] = await Promise.all([
    params,
    searchParams,
    auth(),
  ]);
  const lp = (href: string) => `/${locale}${href}`;
  const maxwellHref = lp(getStartWithMaxwellHref());
  const isAuthenticated = Boolean(session?.user?.email);
  const sessions = isAuthenticated && session?.user?.email
    ? await listUserSessions(session.user.email)
    : [];

  // Restore pre-auth state from URL params (set by UpgradeInput before signin redirect)
  const initialUrl = decodeURIComponent(url);
  const initialMode = mode === "answer_questions" ? "answer_questions" : "best_judgment";

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} upg-rd`}>
      {/* nav */}
      <header className="upg-nav">
        <div className="upg-nav-inner">
          <Link href={lp(siteRoutes.home)} className="upg-nav-logo" aria-label="Noon — home">
            <span style={{ height: 20, display: "inline-flex" }}><NoonWordmark /></span>
          </Link>
          <nav className="upg-nav-links">
            <Link href={lp(siteRoutes.services)} className="active">Services</Link>
            <Link href={lp(siteRoutes.about)}>About</Link>
            <Link href={lp(siteRoutes.contact)}>Contact</Link>
          </nav>
          <Link href={maxwellHref} className="upg-nav-cta upg-btn upg-btn-primary">
            Start with Maxwell
          </Link>
        </div>
      </header>

      <div className="upg-frame" aria-hidden />

      <main className="upg-wrap">
        {/* hero + intake — one framed box (mirrors Contact's .ct-formsection):
            aside (headline + before/after proof) left, intake form right,
            divided by a single border instead of a floating form card. */}
        <section aria-labelledby="upgrade-entry-title" className="upg-hero">
          <div className="upg-hero-frame">
            <div className="upg-hero-grid">
              <div className="upg-hero-aside">
                <div className="upg-hero-inner">
                  <h1 id="upgrade-entry-title" className="upg-display">
                    Upgrade a live website with Maxwell.
                  </h1>
                  <p className="upg-lead">
                    Maxwell audits it, prioritizes what matters, and rebuilds it
                    as real, maintainable code.
                  </p>
                </div>

                <div className="upg-hero-proof">
                  <UpgradeBeforeAfter compact />
                </div>
              </div>

              <div className="upg-hero-form min-w-0">
                <UpgradeInput
                  isAuthenticated={isAuthenticated}
                  initialUrl={initialUrl}
                  initialMode={initialMode}
                />
                {sessions.length > 0 && (
                  <div style={{ maxWidth: 576, marginTop: 16 }}>
                    <UpgradeSessionList sessions={sessions} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* How it works — process cards */}
        <section className="upg-section" style={{ paddingTop: 0 }}>
          <div className="upg-steps-frame">
            <div className="upg-sechead" style={{ gridColumn: "1 / -1", gridRow: 1 }}>
              <h2 className="upg-h2">Three steps to a better website</h2>
            </div>
            <UpgradeSteps />
            {/* real grid items spanning both rows (heading + cards) — height
                comes from the grid's own row sizing, same as everything else
                here, so it can't drift out of sync the way a separately
                measured line could. Every sibling here (heading, cards, these
                dividers) has an EXPLICIT grid-row/column — mixing that with
                auto-placed items caused the auto-placed ones to dodge these
                dividers' reserved cells and land in the wrong row entirely. */}
            <span className="upg-steps-divider" style={{ gridColumn: 2, gridRow: "1 / span 2" }} aria-hidden="true" />
            <span className="upg-steps-divider" style={{ gridColumn: 3, gridRow: "1 / span 2" }} aria-hidden="true" />
          </div>
        </section>

      </main>

      {/* footer — shared across redesign pages */}
      <SiteFooterRd />
    </div>
  );
}

export default function UpgradePage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className={`${GeistSans.variable} ${GeistMono.variable} upg-rd`} style={{ minHeight: "100vh" }} />
      }
    >
      <UpgradePageContent {...props} />
    </Suspense>
  );
}
