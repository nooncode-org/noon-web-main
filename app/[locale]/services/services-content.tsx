"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, ShieldCheck, Blocks, UserRound, Building2 } from "lucide-react";
import { getContactHref, siteRoutes } from "@/lib/site-config";
import { NoonMark } from "@/components/brand/noon-logo";
import { CustomDevChat, CustomDevFlow } from "./custom-dev-chat";
import { UpgradeFlow } from "./upgrade-flow";

const LOCALES = ["en", "es", "fr", "de"];

const HOW_STEPS = [
  { n: "01", label: "Scope", line: "Maxwell scopes the real problem with you — before a line of code." },
  { n: "02", label: "Build", line: "AI builds it fast in a real, production codebase — structured and ready to review." },
  { n: "03", label: "Human review", line: "Every change is read and reviewed by a person before it ships.", on: true },
  { n: "04", label: "Ship", line: "Working software your team operates — reviewed, and made to last." },
];

const CMP_DIMENSIONS = ["What you get", "Who reviews the work", "Ownership & lock-in", "When logic gets serious", "Best when"];
const CMP_OPTIONS = [
  {
    name: "No-code builders", icon: Blocks, hl: false,
    values: ["Flows assembled inside a platform", "Nobody — you are the QA", "Platform lock-in; you rent the logic", "Workarounds pile up, then it collapses", "Prototyping or simple sites"],
  },
  {
    name: "Freelancers", icon: UserRound, hl: false,
    values: ["Code — quality varies by person", "Usually no second pair of eyes", "Yours, if the handoff is clean", "Depends on one person's ceiling", "Small, well-bounded tasks"],
  },
  {
    name: "In-house team", icon: Building2, hl: false,
    values: ["Full control, built over time", "Your senior engineers — if you have them", "Fully yours", "Scales with the team you hired", "Long-term scale justifies the payroll"],
  },
  {
    name: "Noon", icon: ShieldCheck, hl: true,
    values: ["Production software, scoped and shipped", "A senior engineer signs every change", "Yours — code, repository, and IP", "Built for it from the start — a real codebase", "You need real software without building a team"],
  },
];

const FAQS = [
  { q: "Which service do I actually need?", a: "Start from your situation: building something new from scratch points to Custom Development; improving something already live points to Upgrade; needing extra senior capacity points to Engineering Support. And if the problem is real but the right technical move isn't clear yet, that's exactly what the Business Technology Audit is for." },
  { q: "How does a project actually start?", a: "You describe what you want to build — in Maxwell or through Contact. That becomes a clear brief and, for new builds, a working prototype you can react to. A PM reads, corrects, and approves your proposal before it reaches you, and the project activates on payment." },
  { q: "Who does the work — AI or people?", a: "Both, with a clear line: AI accelerates scoping, code, and testing, and a person owns the judgment. Every proposal is approved by a PM and every change is signed off by a senior engineer before it ships." },
  { q: "How is pricing handled?", a: "Pricing depends on scope and complexity. You get a transparent quote after the scoping phase — no hidden fees, no hourly billing surprises. You know the full cost before we start building." },
  { q: "Do I own what you build?", a: "Everything ships as real, production-ready code — no low-code lock-in. Ownership follows the engagement model and what has been paid for and delivered, and your data remains yours throughout." },
  { q: "Can you work on something that already exists?", a: "Yes — that's half the offer. Upgrade improves a live product, the Business Technology Audit maps what to cut, keep, or build across your stack, and Engineering Support embeds senior capacity with your existing team and codebase." },
];

// Short taglines for the overview cards (the full summaries are too long for a
// compact card; these are crisp one-liners derived from each service's copy).
const CARD_TAGLINES: Record<string, string> = {
  "Custom Development": "New software built around your real logic.",
  Upgrade: "A stronger version of what's already live.",
  "Engineering Support": "Senior capacity for your tech operation.",
  "Business Technology Audit": "A diagnosis before you commit.",
};

function UpgradePanel() {
  return <UpgradeFlow />;
}

export function ServicesContent() {
  const params = useParams();
  const paramLocale = typeof params?.locale === "string" ? params.locale : null;
  const locale = paramLocale && LOCALES.includes(paramLocale) ? paramLocale : "en";
  const lp = (href: string) => `/${locale}${href}`;

  const contactHref = lp(getContactHref({ inquiry: "general", source: "services" }));
  const maxwellHref = lp(siteRoutes.maxwellStudio);

  const services = [
    {
      name: "Custom Development",
      summary: "Improve your results in the most efficient way.",
      details: [
        "Describe what you want to achieve or the problem you need to solve in the input field, and start getting results from day one.",
      ],
      href: lp(getContactHref({ inquiry: "new-project", source: "custom-development" })),
      linkLabel: "Discuss custom development",
      illustration: "/figma/card-custom-dev.svg",
      flip: true,
    },
    {
      name: "Upgrade",
      summary: "Optimize your website to achieve better results.",
      details: [
        "Enter your website URL and instantly receive an improved version optimized for design, user experience, and performance.",
      ],
      href: lp(siteRoutes.upgrade),
      linkLabel: "Open Upgrade",
      illustration: "/figma/card-upgrade.svg",
      flip: false,
    },
    {
      name: "Engineering Support",
      summary: "Technical support capacity for software, hardware, infrastructure, and technology operations.",
      details: [],
      href: lp(getContactHref({ inquiry: "general", source: "engineering-support" })),
      linkLabel: "Contact Noon",
      illustration: "/figma/card-engineering-support.svg",
      flip: false,
      showBlock: false,
    },
    {
      name: "Business Technology Audit",
      summary: "A diagnostic review of the business technology and operational setup before deciding what should change.",
      details: [],
      href: lp(getContactHref({ inquiry: "general", source: "business-technology-audit" })),
      linkLabel: "Request an audit conversation",
      illustration: "/figma/card-audit.svg",
      flip: true,
      showBlock: false,
    },
  ];

  return (
    <>
      {/* hero */}
      <section className="svc-hero">
        <div className="svc-wrap">
          <div className="svc-hero-inner">
            <h1 className="svc-display">
              <span className="dim">Four ways </span><span className="accent">Noon </span>drives better outcomes{" "}
              <span className="dim">with solutions built to scale.</span>
            </h1>
          </div>
        </div>
      </section>

      {/* service architecture — overview cards, the intro text, then the detailed
          blocks (original order, nothing moved). A background rail extends the
          overview card dividers straight DOWN behind the text to the box — same
          4-col grid / same wrap, so the lines land exactly on the dividers. */}
      <section className="svc-section" id="services-offer">
        <div className="svc-wrap">
          <div className="svc-cards">
            {/* 2 pin cells: real grid items whose border-right at 50% is the same
                column border as the service cards — no separate overlay needed */}
            <div className="svc-pin-cell" />
            <div className="svc-pin-cell" />
            <div className="svc-cards-pin"><NoonMark /></div>
            {services.map((s) => (
              <Link key={s.name} href={s.href} className="svc-card">
                <div className="svc-card-fig">
                  <Image src={s.illustration} alt="" width={56} height={56} unoptimized />
                </div>
                <div className="svc-card-text">
                  <h3 className="svc-card-name">{s.name}</h3>
                  <p className="svc-card-desc">{CARD_TAGLINES[s.name]}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="svc-services">
            {services.filter((s) => s.showBlock !== false).map((s) => {
              const featured = s.name === "Custom Development";
              const isUpgrade = s.name === "Upgrade";
              const isBig = featured || isUpgrade;
              return (
              <article key={s.name} className={`svc-service ${s.flip ? "flip" : ""} ${isBig ? "featured" : ""}`}>
                {!isBig && (
                  <div className="svc-service-fig">
                    <Image src={s.illustration} alt="" width={148} height={148} unoptimized />
                  </div>
                )}
                {featured && (
                  <div className="cds-panel" aria-hidden>
                    <CustomDevFlow />
                  </div>
                )}
                {isUpgrade && (
                  <div className="cds-panel" aria-hidden>
                    <UpgradePanel />
                  </div>
                )}
                <div className="svc-service-body">
                  <h3 className="svc-service-name">{isBig ? s.summary : s.name}</h3>
                  {!isBig && <p className="svc-service-summary">{s.summary}</p>}
                  <ul className="svc-service-details">
                    {s.details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                  <div className="svc-service-cta">
                    <Link href={s.href}>
                      {s.linkLabel}
                      <ArrowRight className="ic" size={15} strokeWidth={2} />
                    </Link>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* how we work */}
      <section className="svc-section" style={{ paddingTop: 0 }}>
        <div className="svc-wrap">
          <p className="svc-statement">
            We don&apos;t build to a spec sheet —{" "}
            <span className="dim">we build around how your business actually runs.</span>
          </p>
          <div className="svc-how-grid">
            {HOW_STEPS.map((step) => (
              <div key={step.n} className={`svc-step ${step.on ? "on" : ""}`}>
                <span className="svc-step-n">{step.n}</span>
                <h3 className="svc-step-label">{step.label}</h3>
                <p className="svc-step-line">{step.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* CTA */}
      <section className="svc-section" style={{ paddingTop: 0 }}>
        <div className="svc-wrap">
          <div className="svc-cta">
            <h2 className="svc-h2">Start building your idea with Maxwell.</h2>
            <p className="svc-cta-copy">
              Describe what you want to build. Maxwell scopes it with you, and it ships as real,
              human-reviewed software you own.
            </p>
            <Link href={maxwellHref} className="svc-btn svc-btn-primary">
              Start with Maxwell
              <ArrowRight className="ic" size={16} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
