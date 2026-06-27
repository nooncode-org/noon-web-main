import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ArrowRight } from "lucide-react";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { WorkShot } from "@/components/work/work-shot";
import { siteRoutes, getContactHref, getStartWithMaxwellHref, footerLinkGroups, footerSocialLinks } from "@/lib/site-config";
import "./work-rd.css";

export const metadata: Metadata = {
  title: "Work | Noon",
  description:
    "Real software Noon has shipped — internal platforms, product rebuilds, AI integrations and audits, across e-commerce, SaaS, healthcare, fintech and more. Every build human-reviewed.",
};

const STATS = [
  { value: "11", label: "sectors shipped" },
  { value: "100%", label: "human-reviewed" },
  { value: "Yours", label: "code & IP" },
];

// Owner-provided, real, anonymized-by-sector case studies (noon_case_studies.md).
// Content is verbatim from the live /work page — only the execution is redesigned.
type CaseStudy = {
  service: string; sector: string; title: string; summary: string;
  metrics: string[]; stack: string[];
  mockup: { src: string; w: number; h: number; desc: string };
};

const CASES: CaseStudy[] = [
  {
    service: "Custom Development", sector: "E-commerce",
    title: "Manual ops, from 20 h/week to under 3.",
    summary:
      "Inventory in a spreadsheet, orders in the carrier portal, returns in a separate form — the team was the integration. We built an internal operations platform wired directly to Shopify and their 3PL, with AI return classification and customer-response drafting.",
    metrics: ["20h → <3h / week", "−75% order processing time"],
    stack: ["Next.js", "Node.js", "Supabase", "Shopify API", "GPT-4o"],
    mockup: { src: "/work/mockups/cs1-ordwell.html", w: 1440, h: 951, desc: "Operations dashboard with live order metrics, an orders table, and an AI-classified returns queue" },
  },
  {
    service: "Upgrade", sector: "B2B SaaS",
    title: "22% fewer support tickets after a UX rebuild.",
    summary:
      "The product worked, but three years of growth without structure left inconsistent flows and an onboarding that confused users from day one. We did a full frontend rebuild — shorter flows, consistent navigation, a real-time dashboard with a clear hierarchy.",
    metrics: ["−22% UX support tickets", "in the first 60 days"],
    stack: ["React", "TypeScript", "Tailwind"],
    mockup: { src: "/work/mockups/cs2-crewfield.html", w: 1440, h: 1018, desc: "Team-management dashboard with a KPI hero band, team tiles, hiring pipeline, and activity feed" },
  },
  {
    service: "Engineering Support", sector: "Real estate tech",
    title: "4 investor-committed features shipped in 90 days.",
    summary:
      "One technical founder was handling features, bugs, and infrastructure at once — everything bottlenecked. We embedded three developers as a direct extension of the team, with AI market-comparable analysis and buyer-report generation.",
    metrics: ["4 features in 90 days", "−60% production incidents"],
    stack: ["Next.js", "Python", "Supabase", "Vercel", "Claude 3.7 Sonnet"],
    mockup: { src: "/work/mockups/cs3-lotvane.html", w: 1440, h: 975, desc: "Dark property-intelligence app with a live map of price pins and a listing panel with comparables" },
  },
  {
    service: "Business Technology Audit", sector: "Professional services",
    title: "$4,200/month in redundant software, found in two weeks.",
    summary:
      "12 SaaS tools accumulated over years — no one knew which overlapped, which to cut, or what was worth building. A two-week audit covered the full stack, vendor costs, and workflows, ending in a prioritized cut / keep / build plan.",
    metrics: ["$4,200/mo identified", "2 tools → 1 integration"],
    stack: ["Audit", "Roadmap"],
    mockup: { src: "/work/mockups/cs4-stackbrief.html", w: 1440, h: 1022, desc: "Tech-stack audit report with spend metrics, a cost table with keep/consolidate/cut verdicts, and a phased roadmap" },
  },
  {
    service: "Custom Development", sector: "Healthcare",
    title: "No-shows cut from 28% to 11%.",
    summary:
      "Scheduling, reminders, and patient history lived across three disconnected systems, driving high no-shows and manual admin. We built a scheduling + patient-communication platform integrated with their clinical system, with consultation transcription and automated summaries.",
    metrics: ["No-shows 28% → 11%", "−40% admin time / appointment"],
    stack: ["Next.js", "Supabase", "Twilio", "Whisper", "Claude Opus 4.8"],
    mockup: { src: "/work/mockups/cs5-visitra.html", w: 1240, h: 754, desc: "Clinical scheduling app with a weekly calendar, reminder timeline, and an AI visit summary" },
  },
  {
    service: "Custom Development", sector: "Retail",
    title: "34% more repeat purchases in 90 days.",
    summary:
      "Repeat customers had no reason to return, and in-store and online purchase history lived in separate systems — so every campaign was manual and generic. We built a unified loyalty + automated marketing system across their POS and online store.",
    metrics: ["+34% repeat purchases", "+28% AOV from members"],
    stack: ["Next.js", "Node.js", "Supabase", "Stripe", "Resend", "GPT-5.1"],
    mockup: { src: "/work/mockups/cs6-embertide.html", w: 1440, h: 1022, desc: "Warm dark loyalty dashboard with campaign table, revenue bars, membership tiers, and a points activity feed" },
  },
];

const TRACK: { sector: string; project: string }[] = [
  { sector: "E-commerce", project: "Internal operations platform" },
  { sector: "B2B SaaS", project: "Product rebuild & UX overhaul" },
  { sector: "Real estate tech", project: "Embedded engineering team" },
  { sector: "Professional services", project: "Technology audit" },
  { sector: "Healthcare", project: "Scheduling & clinical transcription" },
  { sector: "Retail", project: "Loyalty & automated marketing system" },
  { sector: "Fintech", project: "Reporting dashboard with automated alerts" },
  { sector: "Restaurant group", project: "Online ordering & POS integration" },
  { sector: "EdTech", project: "LMS with conversational AI tutor" },
  { sector: "Legal services", project: "Contract analysis & summarization" },
  { sector: "Property management", project: "Tenant portal & maintenance tracking" },
];

const WORK_FAQS: { q: string; a: string }[] = [
  { q: "Are these real projects?", a: "Yes — every case is real, delivered work, and the outcomes shown are from those engagements. The interfaces are anonymized recreations: names, brands, and data are changed to protect client confidentiality, exactly as noted under the cases." },
  { q: "Why don't you name the clients?", a: "Confidentiality is part of the engagement. Cases are published by sector instead, and nothing identifiable goes public without permission." },
  { q: "My industry isn't on the list — can you still help?", a: "Almost certainly. Eleven sectors so far, and the approach — scope the real problem, build it, review it line by line — carries across industries. Tell us the problem and you'll get a straight read on whether we're the right fit." },
  { q: "What do you build with?", a: "Each case lists its stack — typically Next.js or React on the front, Node and Postgres behind it, and AI where it earns its place. Whatever the stack, the code and IP are yours." },
];

function Ticks() {
  return (
    <>
      {(["tl", "tr", "bl", "br"] as const).map((p) => (
        <span key={p} className={`wr-tick ${p}`} aria-hidden>
          <svg viewBox="0 0 11 11"><path d="M5.5 0V11M0 5.5H11" stroke="currentColor" strokeWidth="1" /></svg>
        </span>
      ))}
    </>
  );
}

type Props = { params: Promise<{ locale: string }> };

export default async function WorkRedesignPage({ params }: Props) {
  const { locale } = await params;
  const lp = (href: string) => `/${locale}${href}`;
  const contactHref = lp(getContactHref({ inquiry: "new-project", source: "work" }));
  const maxwellHref = lp(getStartWithMaxwellHref());

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} work-rd`}>
      {/* nav */}
      <header className="wr-nav">
        <div className="wr-nav-inner">
          <Link href={lp(siteRoutes.home)} className="wr-nav-logo" aria-label="Noon — home">
            <span style={{ height: 20, display: "inline-flex" }}><NoonWordmark /></span>
          </Link>
          <nav className="wr-nav-links">
            <Link href={lp(siteRoutes.services)}>Services</Link>
            <Link href={lp(siteRoutes.about)}>About</Link>
            <Link href={lp(siteRoutes.contact)}>Contact</Link>
          </nav>
          <Link href={maxwellHref} className="wr-nav-cta wr-btn wr-btn-primary wr-btn-sm">
            Start with Maxwell
          </Link>
        </div>
      </header>

      {/* framed-page border (Noon identity / Pathly) — clean, no floating ticks */}
      <div className="wr-frame" aria-hidden />

      <main className="wr-wrap">
        {/* hero */}
        <section className="wr-hero">
          <div className="wr-hero-inner">
            <div>
              <p className="wr-kicker">/ Selected work</p>
              <h1 className="wr-display" style={{ marginTop: 18 }}>Real software, <span style={{ color: "var(--text-secondary)" }}>shipped and</span> reviewed.</h1>
              <p className="wr-lead wr-hero-lead">
                Internal platforms, product rebuilds, AI integrations, and audits — across industries.
                Every build accelerated by AI and reviewed by senior engineers, line by line.
              </p>
              <div className="wr-hero-actions">
                <Link href={contactHref} className="wr-btn wr-btn-primary">Start a project <ArrowRight size={15} /></Link>
                <Link href={lp("/approach")} className="wr-btn wr-btn-secondary">How we work</Link>
              </div>
            </div>
            <div className="wr-hero-proof wr-tickframe">
              <Ticks />
              {STATS.map((s) => (
                <div key={s.label} className="wr-proof-row">
                  <span className="v">{s.value}</span>
                  <span className="l">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* case studies — two-col text + live mockup (Pathly), alternating */}
        <section className="wr-section">
          <p className="wr-kicker" style={{ marginBottom: 36 }}>/ Selected case studies</p>
          <div className="wr-cases">
            {CASES.map((c, i) => (
              <article
                key={c.title}
                id={c.mockup.src.split("/").pop()!.replace(".html", "")}
                className={`wr-case ${i % 2 === 1 ? "flip" : ""}`}
                style={{ scrollMarginTop: 80 }}
              >
                <div className="wr-case-figure">
                  <div className="wr-case-shot">
                    <WorkShot frame={{ src: c.mockup.src, title: c.mockup.desc, w: c.mockup.w, h: c.mockup.h }} />
                  </div>
                </div>
                <div className="wr-case-text">
                  <div className="wr-case-head">
                    <span className="wr-case-kicker">{c.service} · {c.sector}</span>
                  </div>
                  <h3 className="wr-case-title">{c.title}</h3>
                  <p className="wr-case-summary">{c.summary}</p>
                  <div className="wr-metrics">
                    {c.metrics.map((m) => (
                      <span key={m} className="wr-metric">{m}</span>
                    ))}
                  </div>
                  <div className="wr-stack">
                    {c.stack.map((t) => <span key={t}>{t}</span>)}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="wr-honesty">
            Interfaces shown are anonymized recreations of delivered products — names, brands, and data have been changed to protect client confidentiality.
          </p>
        </section>

        {/* track record — technical grid */}
        <section className="wr-section">
          <div className="wr-sechead">
            <h2 className="wr-h2">More across sectors</h2>
            <span className="wr-mono">{TRACK.length} projects</span>
          </div>
          <div className="wr-track">
            <div className="wr-track-grid">
              {TRACK.map((t) => (
                <div key={`${t.sector}-${t.project}`} className="wr-track-row">
                  <span className="dot" />
                  <span className="sector">{t.sector}</span>
                  <span className="project">{t.project}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ — native details accordion (answers doubts before the final CTA) */}
        <section className="wr-section">
          <div className="wr-sechead">
            <h2 className="wr-h2">Questions</h2>
            <span className="wr-mono">FAQ</span>
          </div>
          <div className="wr-faq">
            {WORK_FAQS.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <div className="ans">{f.a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* closing CTA — the final action */}
        <section className="wr-section">
          <div className="wr-cta">
            <p className="wr-kicker" style={{ marginBottom: 14 }}>/ Start a build</p>
            <h2 className="wr-h2" style={{ maxWidth: "18ch", margin: "0 auto" }}>Your project <span style={{ color: "var(--text-secondary)" }}>could be</span> next.</h2>
            <p className="wr-lead" style={{ maxWidth: "46ch", margin: "16px auto 0" }}>
              Tell us what you want to build. We&apos;ll scope it with you and ship it as real, human-reviewed software you own.
            </p>
            <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
              <Link href={contactHref} className="wr-btn wr-btn-primary">Start a project <ArrowRight size={16} /></Link>
            </div>
          </div>
        </section>
      </main>

      {/* footer — Vercel-style organized (real link groups from site-config) */}
      <footer className="wr-footer">
        <div className="wr-wrap">
          <div className="wr-footer-top">
            <div className="wr-footer-brand">
              <span style={{ height: 22, display: "inline-flex", color: "var(--text-primary)" }}><NoonWordmark /></span>
              <p className="tag">Custom software and AI products — every build reviewed by a human, and the code is yours.</p>
            </div>
            <div className="wr-footer-col">
              <h4>Site</h4>
              <ul>{footerLinkGroups.Site.map((l) => <li key={l.name}><Link href={lp(l.href ?? "/")}>{l.name}</Link></li>)}</ul>
            </div>
            <div className="wr-footer-col">
              <h4>Legal</h4>
              <ul>{footerLinkGroups.Legal.map((l) => <li key={l.name}><Link href={lp(l.href ?? "/")}>{l.name}</Link></li>)}</ul>
            </div>
            <div className="wr-footer-col">
              <h4>Connect</h4>
              <ul>{footerSocialLinks.map((l) => <li key={l.name}><a href={l.href} target="_blank" rel="noopener noreferrer">{l.name}</a></li>)}</ul>
            </div>
          </div>
          <div className="wr-footer-bottom">
            <span className="wr-status"><span className="dot" />Every build, human-reviewed</span>
            <span className="wr-footer-copy">© 2026 Noon</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
