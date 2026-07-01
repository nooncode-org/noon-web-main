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
import { BeforeAfterScan } from "@/components/sections/premium";
import { UpgradeDemo } from "@/components/marketing/upgrade-demo/UpgradeDemo";
import { UpgradeSteps } from "@/components/upgrade/upgrade-steps";
import { SiteFooterRd } from "@/app/_components/site/site-footer-rd";
import { siteRoutes, getStartWithMaxwellHref } from "@/lib/site-config";
import "./upgrade-rd.css";
import "@/app/_components/site/site-footer-rd.css";

// Upgrade-specific FAQ — every answer mirrors copy already on this page (the
// hero, the scored-audit section) or the Upgrade service block on /services.
const UPGRADE_FAQS = [
  {
    q: "What do I get from the scan?",
    a: "A clear, scored audit of your site — what's working, critical issues, and prioritized improvements — plus an upgraded version of it generated as real, maintainable code.",
  },
  {
    q: "Do I have to rebuild my whole site?",
    a: "No. Upgrade targets what's underperforming, unclear, or dated and ships a stronger version of what you already run — it's the opposite of a from-scratch rebuild or a vague redesign.",
  },
  {
    q: "Is the upgraded version ready for production?",
    a: "The scan produces the upgraded version and the audit; bringing it live runs through the same process as every Noon build — read and signed off by a person before it ships.",
  },
  {
    q: "What happens after the audit?",
    a: "You decide. Take the prioritized plan and run with it, or have Noon ship the upgrade — the audit is the structured starting point for the Upgrade service.",
  },
];

export const metadata: Metadata = {
  title: "Upgrade Your Website | Noon",
  description:
    "Get an AI-powered audit of your website and a fully upgraded version, then bring it to life with Noon.",
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
            <Link href={lp(siteRoutes.work)}>Work</Link>
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
        {/* hero + intake */}
        <section aria-labelledby="upgrade-entry-title" className="upg-hero">
          <div className="upg-hero-inner">
            <p className="upg-kicker">Upgrade</p>
            <h1 id="upgrade-entry-title" className="upg-display" style={{ marginTop: 10 }}>
              Upgrade a live website with Maxwell.
            </h1>
            <p className="upg-lead">
              Paste your URL — Maxwell audits it, prioritizes what matters, and rebuilds it as
              real, maintainable code.
            </p>
          </div>

          <div className="upg-hero-form">
            <UpgradeInput
              isAuthenticated={isAuthenticated}
              initialUrl={initialUrl}
              initialMode={initialMode}
            />
            {sessions.length > 0 && (
              <div style={{ maxWidth: 576, margin: "0 auto" }}>
                <UpgradeSessionList sessions={sessions} />
              </div>
            )}
          </div>
        </section>

        {/* How it works — process cards */}
        <section className="upg-section" style={{ paddingTop: 0 }}>
          <div className="upg-sechead">
            <p className="upg-kicker">How it works</p>
            <h2 className="upg-h2">Three steps to a better website</h2>
          </div>
          <UpgradeSteps />
        </section>

        {/* What you get back — faithful representation of the real audit output */}
        <section className="upg-section" style={{ paddingTop: 0 }}>
          <div className="upg-sechead">
            <p className="upg-kicker">What you get back</p>
            <h2 className="upg-h2">A clear, scored audit of your site</h2>
          </div>
          <UpgradeDemo />
        </section>

        {/* Before/After transformation */}
        <section className="upg-section" style={{ paddingTop: 0 }}>
          <BeforeAfterScan />
        </section>

        {/* FAQ */}
        <section className="upg-section" style={{ paddingTop: 0 }}>
          <div className="upg-sechead">
            <h2 className="upg-h2">Common questions.</h2>
          </div>
          <div className="upg-faq">
            {UPGRADE_FAQS.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p className="upg-faq-a">{f.a}</p>
              </details>
            ))}
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
