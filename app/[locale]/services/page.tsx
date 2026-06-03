"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, LayoutDashboard, Puzzle, Rocket, Workflow } from "lucide-react";
import { PageSection } from "@/app/_components/site/page-section";
import { SiteCtaBlock } from "@/app/_components/site/site-cta-block";
import { SitePageFrame } from "@/app/_components/site/site-page-frame";
import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import { getContactHref, siteRoutes } from "@/lib/site-config";
import { siteTones } from "@/lib/site-tones";
import { DecisionMap, type DecisionPath } from "@/components/sections/decision-map";
import dynamic from "next/dynamic";

// Client-only: the PipelineShowcase uses framer-motion entrance animations whose
// SSR'd `initial` transforms cause hydration mismatches. It's a below-the-fold
// decorative diagram, so we skip SSR and render a static, content-bearing
// fallback (header + the 4 steps) until the client chunk loads.
const PipelineShowcase = dynamic(
  () => import("@/components/sections/pipeline").then((m) => m.PipelineShowcase),
  { ssr: false, loading: () => <PipelineShowcaseFallback /> }
);

function PipelineShowcaseFallback() {
  const steps: [string, string][] = [
    ["Your need", "Tell us what you want to build"],
    ["Scope with Maxwell", "Scope before execution"],
    ["Human review & build", "Judgment, not blind execution"],
    ["Working software", "Working software, not documentation"],
  ];
  return (
    <section className="site-section">
      <div className="site-shell">
        <div className="mx-auto mb-12 max-w-2xl text-center lg:mb-16">
          <span className="liquid-glass-pill mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            How it works
          </span>
          <h2 className="site-section-title mb-3">
            From problem to <span className="text-muted-foreground">working software.</span>
          </h2>
          <p className="site-section-copy mx-auto max-w-xl text-muted-foreground">
            Maxwell accelerates the definition, senior engineers own the judgment, and the
            result is real software you operate — not a prototype, not documentation.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([label, principle]) => (
            <div key={label} className="border border-foreground/10 bg-card/60 p-4">
              <p className="text-[12px] font-medium text-foreground">{label}</p>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{principle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const LOCALES = ["en", "es", "fr", "de"];

type ServiceItem = {
  name: string;
  summary: string;
  details: string[];
  href: string;
  linkLabel: string;
  tone: typeof siteTones.brand;
  illustration: string;
  imageSide: "left" | "right";
};

// ── "Common problems we solve" — buyer-language diagnostic band. Real content
// (services.problemAreas in messages/en.json, previously unrendered): lets a
// business owner self-recognize the pain before picking a service. Hairline
// 2×2 grid, single-accent, theme-aware.
const PROBLEM_AREAS: { icon: typeof Workflow; problem: string; summary: string; signals: [string, string] }[] = [
  {
    icon: Workflow,
    problem: "Manual work that should be automated",
    summary: "AI-assisted workflows for teams losing time to repetitive work and human bottlenecks.",
    signals: ["Copying data between tools", "Progress depends on one operator"],
  },
  {
    icon: LayoutDashboard,
    problem: "Operations that need one central system",
    summary: "Dashboards and portals that consolidate data, workflows, and reporting into one surface.",
    signals: ["Data across disconnected tools", "No clear source of truth"],
  },
  {
    icon: Rocket,
    problem: "A product that needs to launch as real software",
    summary: "Production-minded builds for founders who understand the problem and need something real.",
    signals: ["Customer problem is validated", "Bottleneck is execution"],
  },
  {
    icon: Puzzle,
    problem: "Workflows that generic tools don't fit",
    summary: "Custom software built around business logic that breaks inside generic tools.",
    signals: ["Relying on workarounds", "Off-the-shelf tools don't fit"],
  },
];

function ProblemAreas() {
  return (
    <PageSection eyebrow="Does this sound familiar?" title="Common problems we solve">
      <div className="overflow-hidden border border-foreground/10">
        <div className="grid gap-px bg-foreground/10 sm:grid-cols-2">
          {PROBLEM_AREAS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.problem} className="flex flex-col bg-background p-6 lg:p-7">
                <span
                  className="mb-4 flex h-8 w-8 items-center justify-center rounded-[8px] text-primary"
                  style={{ backgroundColor: "rgba(18,0,197,0.10)" }}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <h3 className="text-[15px] font-medium leading-snug text-foreground">{p.problem}</h3>
                <p className="mt-2 text-sm leading-snug text-muted-foreground">{p.summary}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.signals.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
                    >
                      <span className="h-1 w-1 rounded-full bg-primary" />
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageSection>
  );
}

export default function ServicesPage() {
  const params = useParams();
  const paramLocale = typeof params?.locale === "string" ? params.locale : null;
  const locale = (paramLocale && LOCALES.includes(paramLocale) ? paramLocale : "en");
  const lp = (href: string) => `/${locale}${href}`;

  const contactHref = lp(getContactHref({ inquiry: "general", source: "services" }));

  const services: ServiceItem[] = [
    {
      name: "Custom Development",
      summary:
        "New software built around your business logic, users, workflows, and operational constraints.",
      details: [
        "Best for internal tools, customer portals, platforms, automations, dashboards, and products that need a real codebase.",
        "Noon helps clarify the problem, shape the scope, and turn the work into production-minded software.",
      ],
      href: lp(getContactHref({ inquiry: "new-project", source: "custom-development" })),
      linkLabel: "Discuss custom development",
      tone: siteTones.brand,
      illustration: "/figma/card-custom-dev.svg",
      imageSide: "right",
    },
    {
      name: "Upgrade",
      summary:
        "Improve an existing website or product surface when the current version is underperforming, unclear, or dated.",
      details: [
        "Use this when you already have something live and need a stronger version, not a vague redesign request.",
        "The existing Upgrade flow remains available as the structured starting point for this service.",
      ],
      href: lp(siteRoutes.upgrade),
      linkLabel: "Open Upgrade",
      tone: siteTones.services,
      illustration: "/figma/card-upgrade.svg",
      imageSide: "left",
    },
    {
      name: "Engineering Support",
      summary:
        "Technical support capacity for software, hardware, infrastructure, and technology operations.",
      details: [
        "Support can involve one person or several, depending on the need and scope.",
        "Engagements may be remote, on-site, or hybrid. Physical interventions are handled by request and availability.",
      ],
      href: lp(getContactHref({ inquiry: "general", source: "engineering-support" })),
      linkLabel: "Contact Noon",
      tone: siteTones.gateway,
      illustration: "/figma/card-engineering-support.svg",
      imageSide: "right",
    },
    {
      name: "Business Technology Audit",
      summary:
        "A diagnostic review of the business technology and operational setup before deciding what should change.",
      details: [
        "Best when the problem is real but the right technical move is not yet clear.",
        "The audit looks at technology, operations, constraints, and practical next steps. It uses the general contact route.",
      ],
      href: lp(getContactHref({ inquiry: "general", source: "business-technology-audit" })),
      linkLabel: "Request an audit conversation",
      tone: siteTones.data,
      illustration: "/figma/card-audit.svg",
      imageSide: "left",
    },
  ];

  const decisionPaths: DecisionPath[] = [
    {
      key: "build",
      label: "Build path",
      situation: "Something new",
      prompt: "An idea, product, or system to build from scratch.",
      steps: [
        {
          name: "Custom Development",
          meta: "New build",
          tagline: "Built around your real logic.",
          line: "Software built around your real logic, users, and workflows.",
          href: services[0].href,
          icon: "boxes",
        },
        {
          name: "Engineering Support",
          meta: "Ongoing",
          tagline: "Kept running after launch.",
          line: "Technical capacity to keep it running and evolving after launch.",
          href: services[2].href,
          icon: "support",
        },
      ],
    },
    {
      key: "improve",
      label: "Improvement path",
      situation: "Something that exists",
      prompt: "Software that's underperforming, unclear, or dated.",
      steps: [
        {
          name: "Business Technology Audit",
          meta: "Diagnostic",
          tagline: "Find the real bottleneck.",
          line: "Find the real bottleneck before committing to a change.",
          href: services[3].href,
          icon: "audit",
        },
        {
          name: "Upgrade",
          meta: "Existing surface",
          tagline: "A stronger version, shipped.",
          line: "Ship a stronger version of what you already have live.",
          href: services[1].href,
          icon: "upgrade",
        },
      ],
    },
  ];

  const { ref: headerRef, isVisible: headerVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.1 });

  return (
    <SitePageFrame>
      {/* figma-canon: forces Instrument Sans (the Figma typeface) on this page's
          headings, overriding the site's default serif display face. */}
      <div className="figma-canon">
      {/* Figma "open grid" hero rebuilt at web-main scale (site-hero-title / site-shell),
          light + dark via local --gl grid-line var. Replaces the prior card hero. */}
      <section ref={headerRef} className="site-hero-section relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [--gl:rgba(17,17,17,0.07)] dark:[--gl:rgba(255,255,255,0.06)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--gl) 1px, transparent 1px), linear-gradient(to bottom, var(--gl) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            backgroundPosition: "center",
            maskImage:
              "radial-gradient(ellipse 65% 62% at 50% 44%, #000 22%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 65% 62% at 50% 44%, #000 22%, transparent 80%)",
          }}
        />
        <div className="site-shell relative">
          <div className="relative mx-auto max-w-3xl py-12 text-center lg:py-16">
            <h1
              className={`site-hero-title relative z-0 mb-5 transition-all duration-700 ${
                headerVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
              style={{ transitionDelay: "100ms" }}
            >
              {/* Figma color split: emphasis words at foreground, rest muted. */}
              <span className="text-muted-foreground">Four ways</span> Noon{" "}
              <span className="text-muted-foreground">helps teams move from problem</span>{" "}
              to working software.
            </h1>
            <p
              className={`site-hero-copy mx-auto mb-8 max-w-2xl text-muted-foreground transition-all duration-700 ${
                headerVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              Noon covers four primary needs: building new software, upgrading what already exists,
              supporting the technology operation, and auditing the business technology stack before
              decisions are made.
            </p>
            <div
              className={`flex flex-wrap justify-center gap-4 transition-all duration-700 ${
                headerVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
              style={{ transitionDelay: "300ms" }}
            >
              <Link
                href="#services-offer"
                className="group site-primary-action inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
              >
                Review services
                <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
              </Link>
              <Link
                href={contactHref}
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Contact Noon
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PageSection
        id="services-offer"
        className="pt-4 pb-8 lg:pt-5 lg:pb-10"
      >
        {/* Figma /Services intro card — "OFFER · The service architecture"
           lives inside a bordered card with a faded "noon" wordmark decoration
           on the right (intro-decor.svg). Replaces the previous plain
           section-header (eyebrow/title/description) rendering. */}
        <div className="divide-y divide-foreground/10 overflow-hidden border border-foreground/10 bg-card/40">
          <div className="relative overflow-hidden p-6 lg:p-8">
          <Image
            src="/figma/intro-decor.svg"
            alt=""
            aria-hidden
            width={435}
            height={162}
            unoptimized
            className="pointer-events-none absolute -right-12 bottom-0 hidden h-auto w-[480px] invert dark:invert-0 lg:block"
          />
          <div className="relative max-w-2xl">
            <span className="site-meta-label mb-4 inline-flex items-center gap-3 font-mono text-muted-foreground">
              <span className="h-px w-8 bg-foreground/30" />
              Offer
            </span>
            <h2 className="site-section-title mb-3">The service architecture</h2>
            <p className="site-section-copy text-muted-foreground">
              The order below is intentional: first define whether the work is a new build, an upgrade, ongoing support, or a diagnostic audit.
            </p>
          </div>
        </div>

        {/* Figma-style service blocks — connected with a divider only (no gap),
            alternating illustration sides. */}
          {services.map((service) => {
            const imageFirst = service.imageSide === "left";

            return (
              <article
                key={service.name}
                className="overflow-hidden"
              >
                {/* lg:min-h ensures all 4 cards have the same vertical extent
                   regardless of bullet count or illustration aspect ratio. */}
                <div className={`flex flex-col lg:min-h-[280px] ${imageFirst ? "lg:flex-row" : "lg:flex-row-reverse"}`}>
                  {/* Illustration panel — fixed-width column with a uniform
                     160×160 inner box. All 4 SVGs are object-contained inside
                     that box so different aspect ratios (headphones wide,
                     clipboard tall) render at the same visible size. The
                     divider sits only on the side adjacent to the text panel. */}
                  <div
                    className={`relative flex shrink-0 items-center justify-center p-8 lg:w-[280px] border-foreground/10 ${
                      imageFirst ? "lg:border-r" : "lg:border-l"
                    }`}
                  >
                    <div className="relative h-[160px] w-[160px]">
                      <Image
                        src={service.illustration}
                        alt=""
                        fill
                        sizes="160px"
                        className="object-contain opacity-70 invert dark:invert-0"
                        unoptimized
                      />
                    </div>
                  </div>

                  {/* Text panel — Figma sandbox has NO icon badge; just the title. */}
                  <div className="flex flex-1 flex-col gap-3 p-6 lg:p-8">
                    <h3 className="site-card-title">{service.name}</h3>
                    <p className="site-card-copy text-muted-foreground">{service.summary}</p>
                    <ul className="space-y-2">
                      {service.details.map((detail) => (
                        <li key={detail} className="flex gap-2.5 text-sm leading-6 text-muted-foreground">
                          <span
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: siteTones.brand.accent }}
                          />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                    {/* Figma /Services: outlined CTA anchored to the bottom-left
                       corner of the text panel (mt-auto pushes it to the end of
                       the flex column), with 10px border radius (not full pill).
                       Color uniforme azul para los 4 cards (experimentando — se
                       revierte cambiando siteTones.brand por service.tone). */}
                    <Link
                      href={service.href}
                      className="group mt-auto inline-flex w-fit items-center gap-2 border bg-background/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background/70"
                      style={{ borderColor: "rgba(18, 0, 197, 0.65)" }}
                    >
                      {service.linkLabel}
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </PageSection>

      {/* Enrichment — "Common problems we solve" diagnostic band (real
         services.problemAreas content) so a business owner self-recognizes
         their pain before choosing a service. */}
      <ProblemAreas />

      {/* Figma /Services frame 189:795 — large 3-line statement between the
         service cards and the decision guide. Mirrors sandbox home/Statement.tsx
         behavior: each word starts muted and progressively highlights to
         foreground as the section scrolls through the viewport (word-by-word
         reveal threshold). */}
      <ScrollLitStatement />

      <PageSection
        id="which-service"
        className="bg-secondary/30 py-8 lg:py-10"
      >
        {/* Decision map — two real business paths rendered as small animated
           pipelines (connectors draw + a dot travels) instead of a flat grid.
           See components/sections/decision-map.tsx. */}
        <DecisionMap
          eyebrow="Decision guide"
          title="Start where you are."
          subtitle="Noon covers four services across two paths — a build path for new software, and an improvement path for what you already run. Pick the closest fit and we adjust the route after reviewing your context."
          paths={decisionPaths}
        />
      </PageSection>

      {/* Premium: The Noon Pipeline - Interactive visualization */}
      <PipelineShowcase />

      <SiteCtaBlock
        title="Start building your idea with Maxwell here"
        blockHref={lp(siteRoutes.maxwellStudio)}
        className="pt-8 pb-10 lg:pt-10 lg:pb-12"
      />
      </div>
    </SitePageFrame>
  );
}

// ============================================================================
// Scroll-driven Statement section — replicates sandbox home/Statement.tsx
// behavior: every word starts muted and lights up to foreground as the
// section scrolls through the viewport. Uses CSS vars so light + dark both
// work without hardcoded hex values.
// ============================================================================

const STATEMENT_PARAGRAPHS: ReadonlyArray<string> = [
  "We don't build to a spec sheet — we build around how your business actually runs.",
  "Maxwell scopes the real problem with you, senior engineers own the build, and every change is reviewed by a person before it ships.",
  "You get production software your team operates — reviewed, maintainable, and made to last, not a prototype or a slide deck.",
];

function ScrollLitStatement() {
  const sectionRef = useRef<HTMLElement>(null);
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const apply = (span: HTMLSpanElement, lit: boolean) => {
      span.style.color = lit ? "var(--foreground)" : "var(--muted-foreground)";
      span.style.opacity = lit ? "1" : "0.18";
    };

    const update = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // Tighter range: progress alcanza 1 cuando la sección llega a ~20%
      // del viewport (antes de salir por arriba), así la barra queda 100%
      // filled durante la mayor parte del recorrido visible.
      const scrolled = vh * 0.85 - rect.top;
      const range = vh * 0.7;
      const progress = Math.max(0, Math.min(1, scrolled / range));

      const spans = spanRefs.current.filter(Boolean) as HTMLSpanElement[];
      const total = Math.max(1, spans.length);
      spans.forEach((span, i) => {
        const threshold = i / total;
        apply(span, progress >= threshold);
      });

      // Barra lateral: actualiza una CSS var con el % de progreso. Un
      // gradient hard-stop pinta blanco sólido hasta ese % y muted abajo,
      // sin transition para evitar lag con el scroll.
      if (progressBarRef.current) {
        progressBarRef.current.style.setProperty("--progress", `${progress * 100}%`);
      }
    };

    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);

  let wi = 0;
  return (
    <section ref={sectionRef} className="site-section">
      <div className="site-shell">
        {/* Vertical accent bar: una sola barra con gradient hard-stop. La
           CSS var --progress (actualizada por JS en cada scroll) corta el
           gradient entre blanco sólido (parte filled) y muted (parte por
           rellenar). */}
        <div className="mx-auto max-w-6xl py-12 lg:py-20">
          {/* Wrapper relative que abraza solo el texto (no el padding
             vertical externo). La barra es hermana del contenido, no
             child del space-y, para que no afecte el margen del primer
             párrafo. */}
          <div className="relative">
            <div
              ref={progressBarRef}
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
              style={{
                ["--progress" as string]: "0%",
                background:
                  "linear-gradient(to bottom, var(--foreground) 0%, var(--foreground) var(--progress), rgba(127,127,127,0.25) var(--progress), rgba(127,127,127,0.25) 100%)",
              }}
            />
            <div className="space-y-5 pl-6 lg:pl-8">
            {STATEMENT_PARAGRAPHS.map((paragraph, pi) => {
            const words = paragraph.split(" ");
            return (
              <p key={pi} className="site-hero-title">
                {words.map((word, wIdx) => {
                  const idx = wi++;
                  return (
                    <span
                      key={`${pi}-${wIdx}`}
                      ref={(el) => {
                        spanRefs.current[idx] = el;
                      }}
                      style={{
                        color: "var(--muted-foreground)",
                        opacity: 0.18,
                        transition: "color 0.45s ease, opacity 0.45s ease",
                      }}
                    >
                      {word}
                      {wIdx < words.length - 1 ? " " : ""}
                    </span>
                  );
                })}
              </p>
            );
          })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
