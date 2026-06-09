import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { WorkShot } from "@/components/work/work-shot";
import { SitePageFrame } from "@/app/_components/site/site-page-frame";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { getContactHref } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Work | Noon",
  description:
    "Real software Noon has shipped — internal platforms, product rebuilds, AI integrations and audits, across e-commerce, SaaS, healthcare, fintech and more. Every build human-reviewed.",
};

// Owner-provided, real, anonymized-by-sector case studies + track record
// (noon_case_studies.md, 2026-06-06). Metric-in-the-title per the Vercel/Stripe
// pattern. Model names are kept — they describe the client product's stack and
// are allowed per the owner's framing decision.
type CaseStudy = {
  service: string;
  sector: string;
  title: string; // the result, as the headline
  summary: string; // problem → what we built, condensed
  metrics: string[];
  stack: string[];
  // Anonymized product recreation (Claude Design handoff → self-contained live
  // HTML, public/work/mockups/). Fictional product identity; disclosed below.
  mockup: { src: string; w: number; h: number; desc: string };
};

const CASES: CaseStudy[] = [
  {
    service: "Custom Development",
    sector: "E-commerce",
    title: "Manual ops, from 20 h/week to under 3.",
    summary:
      "Inventory in a spreadsheet, orders in the carrier portal, returns in a separate form — the team was the integration. We built an internal operations platform wired directly to Shopify and their 3PL, with AI return classification and customer-response drafting.",
    metrics: ["20h → <3h / week", "−75% order processing time"],
    stack: ["Next.js", "Node.js", "Supabase", "Shopify API", "GPT-4o"],
    mockup: {
      src: "/work/mockups/cs1-ordwell.html",
      w: 1440,
      h: 953,
      desc: "Operations dashboard with live order metrics, an orders table, and an AI-classified returns queue",
    },
  },
  {
    service: "Upgrade",
    sector: "B2B SaaS",
    title: "22% fewer support tickets after a UX rebuild.",
    summary:
      "The product worked, but three years of growth without structure left inconsistent flows and an onboarding that confused users from day one. We did a full frontend rebuild — shorter flows, consistent navigation, a real-time dashboard with a clear hierarchy.",
    metrics: ["−22% UX support tickets", "in the first 60 days"],
    stack: ["React", "TypeScript", "Tailwind"],
    mockup: {
      src: "/work/mockups/cs2-crewfield.html",
      w: 1440,
      h: 1020,
      desc: "Team-management dashboard with a KPI hero band, team tiles, hiring pipeline, and activity feed",
    },
  },
  {
    service: "Engineering Support",
    sector: "Real estate tech",
    title: "4 investor-committed features shipped in 90 days.",
    summary:
      "One technical founder was handling features, bugs, and infrastructure at once — everything bottlenecked. We embedded three developers as a direct extension of the team, with AI market-comparable analysis and buyer-report generation.",
    metrics: ["4 features in 90 days", "−60% production incidents"],
    stack: ["Next.js", "Python", "Supabase", "Vercel", "Claude 3.7 Sonnet"],
    mockup: {
      src: "/work/mockups/cs3-lotvane.html",
      w: 1440,
      h: 977,
      desc: "Dark property-intelligence app with a live map of price pins and a listing panel with comparables",
    },
  },
  {
    service: "Business Technology Audit",
    sector: "Professional services",
    title: "$4,200/month in redundant software, found in two weeks.",
    summary:
      "12 SaaS tools accumulated over years — no one knew which overlapped, which to cut, or what was worth building. A two-week audit covered the full stack, vendor costs, and workflows, ending in a prioritized cut / keep / build plan.",
    metrics: ["$4,200/mo identified", "2 tools → 1 integration"],
    stack: ["Audit", "Roadmap"],
    mockup: {
      src: "/work/mockups/cs4-stackbrief.html",
      w: 1440,
      h: 1024,
      desc: "Tech-stack audit report with spend metrics, a cost table with keep/consolidate/cut verdicts, and a phased roadmap",
    },
  },
  {
    service: "Custom Development",
    sector: "Healthcare",
    title: "No-shows cut from 28% to 11%.",
    summary:
      "Scheduling, reminders, and patient history lived across three disconnected systems, driving high no-shows and manual admin. We built a scheduling + patient-communication platform integrated with their clinical system, with consultation transcription and automated summaries.",
    metrics: ["No-shows 28% → 11%", "−40% admin time / appointment"],
    stack: ["Next.js", "Supabase", "Twilio", "Whisper", "Claude Opus 4.8"],
    mockup: {
      src: "/work/mockups/cs5-visitra.html",
      w: 1584,
      h: 756,
      desc: "Clinical scheduling app on desktop and mobile, with a weekly calendar, reminder timeline, and AI visit summary",
    },
  },
  {
    service: "Custom Development",
    sector: "Retail",
    title: "34% more repeat purchases in 90 days.",
    summary:
      "Repeat customers had no reason to return, and in-store and online purchase history lived in separate systems — so every campaign was manual and generic. We built a unified loyalty + automated marketing system across their POS and online store.",
    metrics: ["+34% repeat purchases", "+28% AOV from members"],
    stack: ["Next.js", "Node.js", "Supabase", "Stripe", "Resend", "GPT-5.1"],
    mockup: {
      src: "/work/mockups/cs6-embertide.html",
      w: 1440,
      h: 1024,
      desc: "Warm dark loyalty dashboard with campaign table, revenue bars, membership tiers, and a points activity feed",
    },
  },
];

const STATS: { value: string; label: string }[] = [
  { value: "10", label: "sectors shipped" },
  { value: "100%", label: "human-reviewed" },
  { value: "Yours", label: "code & IP ownership" },
];

const TRACK: { sector: string; project: string }[] = [
  { sector: "E-commerce", project: "Internal operations platform" },
  { sector: "B2B SaaS", project: "Product rebuild & UX overhaul" },
  { sector: "Real estate tech", project: "Embedded engineering team" },
  { sector: "Professional services", project: "Technology audit" },
  { sector: "Healthcare", project: "Scheduling & clinical transcription" },
  { sector: "Fintech", project: "Reporting dashboard with automated alerts" },
  { sector: "Restaurant group", project: "Online ordering & POS integration" },
  { sector: "EdTech", project: "LMS with conversational AI tutor" },
  { sector: "Legal services", project: "Contract analysis & summarization" },
  { sector: "Property management", project: "Tenant portal & maintenance tracking" },
];

type WorkPageProps = { params: Promise<{ locale: string }> };

export default async function WorkPage({ params }: WorkPageProps) {
  const { locale } = await params;
  const lp = (href: string) => `/${locale}${href}`;
  const viewer = await getAuthenticatedViewer();
  const contactHref = lp(getContactHref({ inquiry: "new-project", source: "work" }));

  return (
    <SitePageFrame viewer={viewer}>
      <div className="site-shell py-12 lg:py-16">
        {/* header */}
        <div className="mx-auto mb-10 max-w-3xl text-center lg:mb-12">
          <p className="site-meta-label mb-4 font-mono text-muted-foreground">Selected work</p>
          <h1 className="site-hero-title mb-4">Real software, shipped and reviewed.</h1>
          <p className="site-hero-copy mx-auto max-w-xl text-muted-foreground">
            Internal platforms, product rebuilds, AI integrations, and audits — across industries.
            Every build accelerated by AI and reviewed by senior engineers, line by line.
          </p>
        </div>

        {/* stat band */}
        <div className="mx-auto mb-12 max-w-3xl overflow-hidden rounded-[12px] border border-foreground/12 lg:mb-16">
          <div className="grid grid-cols-3 gap-px bg-foreground/10">
            {STATS.map((s) => (
              <div key={s.label} className="bg-background px-3 py-5 text-center lg:py-6">
                <div className="text-[22px] font-semibold tracking-[-0.02em] text-foreground lg:text-[26px]">
                  {s.value}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* case studies — compact side-by-side rows (Linear/Vercel pattern).
           The inline mockup is a small LIVE preview beside the copy; the Expand
           lightbox opens it large + interactive, so the preview can stay small
           — owner asked for less page footprint than the full-width stack. */}
        <div className="mx-auto max-w-6xl space-y-12 lg:space-y-16">
          {CASES.map((c, i) => (
            <article
              key={c.title}
              className="grid items-center gap-5 lg:grid-cols-12 lg:gap-10"
            >
              <div className={`lg:col-span-7 ${i % 2 === 1 ? "lg:order-2" : ""}`}>
                <WorkShot frame={{ src: c.mockup.src, title: c.mockup.desc, w: c.mockup.w, h: c.mockup.h }} />
              </div>
              <div className={`lg:col-span-5 ${i % 2 === 1 ? "lg:order-1" : ""}`}>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    {c.service} · {c.sector}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-primary/[0.06] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-primary">
                    <ShieldCheck className="h-2.5 w-2.5" strokeWidth={2.25} /> Human-reviewed
                  </span>
                </div>
                <h2 className="mt-3 text-[19px] font-semibold leading-snug tracking-[-0.015em] text-foreground lg:text-[23px]">
                  {c.title}
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {c.summary}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.metrics.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-background px-2.5 py-1 text-[11.5px] font-medium text-foreground"
                    >
                      <span className="h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {m}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {c.stack.map((t, j) => (
                    <span key={t} className="font-mono text-[10.5px] text-muted-foreground/60">
                      {t}
                      {j < c.stack.length - 1 && <span className="ml-3 text-muted-foreground/25">·</span>}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* honesty note — the shots are anonymized recreations, not client UIs */}
        <p className="mx-auto mt-5 max-w-5xl text-center font-mono text-[10.5px] text-muted-foreground/55">
          Interfaces shown are anonymized recreations of delivered products — names, brands, and
          data have been changed to protect client confidentiality.
        </p>

        {/* track record */}
        <div className="mx-auto mt-16 max-w-5xl lg:mt-20">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="site-section-title">More across sectors</h2>
            <span className="font-mono text-[11px] text-muted-foreground/60">{TRACK.length} projects</span>
          </div>
          <div className="overflow-hidden rounded-[12px] border border-foreground/12">
            <div className="grid gap-px bg-foreground/10 sm:grid-cols-2">
              {TRACK.map((t) => (
                <div key={`${t.sector}-${t.project}`} className="flex items-center gap-3 bg-background px-5 py-3.5">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted-foreground/70">
                    {t.sector}
                  </span>
                  <span className="truncate text-sm text-foreground/85">{t.project}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* closing CTA */}
        <div className="mx-auto mt-16 max-w-3xl rounded-[12px] border border-foreground/10 bg-card/40 p-8 text-center lg:mt-20">
          <h2 className="site-section-title mb-3">Your project could be next.</h2>
          <p className="site-section-copy mx-auto mb-5 max-w-xl text-muted-foreground">
            Tell us what you want to build. We&apos;ll scope it with you and ship it as real,
            human-reviewed software you own.
          </p>
          <Link
            href={contactHref}
            className="site-primary-action inline-flex h-11 items-center rounded-full px-6 text-sm font-medium"
          >
            Start a project
          </Link>
        </div>
      </div>
    </SitePageFrame>
  );
}
