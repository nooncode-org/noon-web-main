"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageSection } from "@/app/_components/site/page-section";
import { SiteCtaBlock } from "@/app/_components/site/site-cta-block";
import { SitePageFrame } from "@/app/_components/site/site-page-frame";
import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import { getContactHref, siteRoutes } from "@/lib/site-config";
import { siteTones } from "@/lib/site-tones";

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

type DecisionItem = {
  label: string;
  description: string;
  tone: typeof siteTones.brand;
};

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

  const decisionGuide: DecisionItem[] = [
    {
      label: "You need Custom Development",
      description:
        "when the business needs a new system, workflow, platform, product, or integration built around specific logic.",
      tone: siteTones.brand,
    },
    {
      label: "You need Upgrade",
      description:
        "when something already exists and the goal is to improve clarity, structure, conversion, performance, or product quality.",
      tone: siteTones.services,
    },
    {
      label: "You need Engineering Support",
      description:
        "when the business needs technical capacity across software, hardware, infrastructure, or operational technology.",
      tone: siteTones.gateway,
    },
    {
      label: "You need Business Technology Audit",
      description:
        "when the symptoms are visible but the real bottleneck, priority, or implementation path needs diagnosis first.",
      tone: siteTones.data,
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
                className="site-primary-action inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
              >
                Review services
                <ArrowRight className="h-4 w-4" />
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
        <div className="relative mb-6 overflow-hidden border border-foreground/10 bg-card/40 p-6 lg:mb-8 lg:p-8">
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

        {/* Figma-style service cards: technical line illustration + text,
            alternating sides. Built at web-main scale (site-card-title / text-sm).
            Illustrations use `invert dark:invert-0` so the light-stroked SVGs
            read correctly in both themes. */}
        <div className="flex flex-col gap-4 lg:gap-5">
          {services.map((service) => {
            const imageFirst = service.imageSide === "left";

            return (
              <article
                key={service.name}
                className="overflow-hidden border border-foreground/10 bg-card/60"
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
                      className="mt-auto inline-flex w-fit items-center gap-2 border bg-background/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background/70"
                      style={{ borderColor: "rgba(18, 0, 197, 0.65)" }}
                    >
                      {service.linkLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </PageSection>

      {/* Figma /Services frame 189:795 — large 3-line statement between the
         service cards and the decision guide. Mirrors sandbox home/Statement.tsx
         behavior: each word starts muted and progressively highlights to
         foreground as the section scrolls through the viewport (word-by-word
         reveal threshold). */}
      <ScrollLitStatement />

      <PageSection
        id="which-service"
        eyebrow="Decision guide"
        title="Which service do you need?"
        description="Use this as a practical first filter. Noon can still adjust the route after reviewing the context."
        className="bg-secondary/30 py-8 lg:py-10"
      >
        {/* Figma /Services decision-guide cards: number chip on left + an
           accent-bordered pill button containing the service name. The
           description below references both. Mirrors sandbox DecisionGuide.tsx
           (NumberBadge + bordered chip). */}
        <div className="grid gap-4 md:grid-cols-2">
          {decisionGuide.map((item, index) => (
            <div key={item.label} className="border border-foreground/10 bg-background/70 p-5 lg:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center border bg-background/40 text-xs font-mono text-foreground"
                  style={{ borderColor: "rgba(18, 0, 197, 0.65)" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className="inline-flex items-center border bg-background/40 px-3 py-1.5 text-sm font-medium text-foreground"
                  style={{ borderColor: "rgba(18, 0, 197, 0.65)" }}
                >
                  {item.label}
                </span>
              </div>
              <p className="site-card-copy text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </PageSection>

      <SiteCtaBlock
        title="Start building your idea with Maxwell here"
        blockHref={lp(siteRoutes.home)}
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
  "We don't develop generic software to meet a list of requirements.",
  "We design, plan, and develop high-performance systems that meet your strict business constraints.",
  "If you're ready to launch, select your pipeline below.",
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
