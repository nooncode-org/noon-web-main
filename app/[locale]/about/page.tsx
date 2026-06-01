"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SitePageFrame } from "@/app/_components/site/site-page-frame";
import { SiteCtaBlock } from "@/app/_components/site/site-cta-block";
import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import { getContactHref, siteRoutes } from "@/lib/site-config";
import { siteTones } from "@/lib/site-tones";
import { FaqSection } from "@/components/landing/faq-section";
import { ComparisonShowcase } from "@/components/sections/premium";

const LOCALES = ["en", "es", "fr", "de"];

// ============================================================================
// SHARED — grid backdrop (same idea as the hero, reused only where the Figma
// shows a grid). Light/dark aware via the --gl custom property.
// ============================================================================

function GridBackdrop({
  mask = "radial-gradient(ellipse 70% 70% at 50% 50%, #000 18%, transparent 78%)",
}: {
  mask?: string;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 [--gl:rgba(17,17,17,0.07)] dark:[--gl:rgba(255,255,255,0.06)]"
      style={{
        backgroundImage:
          "linear-gradient(to right, var(--gl) 1px, transparent 1px), linear-gradient(to bottom, var(--gl) 1px, transparent 1px)",
        backgroundSize: "72px 72px",
        backgroundPosition: "center",
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default function AboutPage() {
  const t = useTranslations("about");
  const params = useParams();
  const paramLocale = typeof params?.locale === "string" ? params.locale : null;
  const locale = (paramLocale && LOCALES.includes(paramLocale) ? paramLocale : null) ?? "en";

  const lp = (href: string) => `/${locale}${href}`;
  const contactHref = lp(getContactHref({ inquiry: "general", source: "about" }));

  type PrincipleItem = { number: string; title: string; description: string };
  const principles = t.raw("operatingModel.principles") as PrincipleItem[];
  const notNoon = t.raw("operatingModel.notNoon") as string[];

  const { ref: headerRef, isVisible: headerVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.1 });

  return (
    <SitePageFrame>
      {/* figma-canon: Instrument Sans (the Figma typeface) on headings. */}
      <div className="figma-canon">
      {/* Hero — Figma open-grid treatment (consistent with /services & /opportunities) */}
      <section ref={headerRef} className="site-hero-section relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [--gl:rgba(17,17,17,0.07)] dark:[--gl:rgba(255,255,255,0.06)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--gl) 1px, transparent 1px), linear-gradient(to bottom, var(--gl) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            backgroundPosition: "center",
            maskImage: "radial-gradient(ellipse 65% 62% at 50% 42%, #000 22%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 65% 62% at 50% 42%, #000 22%, transparent 80%)",
          }}
        />
        <div className="site-shell relative">
          <div className="mx-auto max-w-3xl py-12 text-center lg:py-16">
            <h1
              className={`site-hero-title mb-5 transition-all duration-700 ${headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: "100ms" }}
            >
              {/* Figma split: first part muted, emphasis part foreground */}
              <span className="text-muted-foreground">{t("hero.headline")}</span>{" "}
              {t("hero.headlineMuted")}
            </h1>
            <p
              className={`site-hero-copy mx-auto mb-8 max-w-2xl text-muted-foreground transition-all duration-700 ${headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: "200ms" }}
            >
              {t("hero.description")}
            </p>
            <div
              className={`flex flex-wrap justify-center gap-4 transition-all duration-700 ${headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: "300ms" }}
            >
              <Link
                href={lp(siteRoutes.maxwellStudio)}
                className="site-primary-action inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
              >
                {t("hero.startWithMaxwell")}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={lp(siteRoutes.services)}
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary"
              >
                {t("cta.viewServices")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          1. VALUE PROPS — 5 cards (Figma "Turn ambiguity..." bento).
             i18n: reuses thesis.* keys.
         =================================================================== */}
      <section className="site-section">
        <div className="site-shell">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
            {/* Feature card — file-tree visual. Icon source: sandbox VALUE_PROPS[feature].iconSrc */}
            <ValueCard delay={0} className="lg:col-span-7 flex flex-col p-6 lg:p-8">
              <ValuePropIcon src="/figma/icons/icon-feature.svg" />
              <h3 className="site-card-title mt-8 max-w-md">{t("thesis.mainTitle")}</h3>
              <p className="site-card-copy mt-3 max-w-md text-muted-foreground">{t("thesis.mainDescription")}</p>
              <FileTreeMockup />
            </ValueCard>

            {/* Two stacked compact cards — icons from sandbox VALUE_PROPS[clear|ai].iconSrc */}
            <div className="grid gap-4 lg:col-span-5 lg:gap-6">
              <CompactCard
                delay={100}
                icon={<ValuePropIcon src="/figma/icons/icon-clear-process.svg" />}
                title={t("thesis.clearProcess")}
                description={t("thesis.clearProcessDescription")}
                badge="Step 1/4"
                tone={siteTones.gateway}
              />
              <CompactCard
                delay={200}
                icon={<ValuePropIcon src="/figma/icons/icon-ai.svg" />}
                title={t("thesis.aiAccelerated")}
                description={t("thesis.aiAcceleratedDescription")}
                badge="AI-powered"
                tone={siteTones.data}
              />
            </div>

            {/* Two wide cards — sandbox uses the small SVG icon on the LEFT and
               the larger card-*.svg illustration on the RIGHT (not the reverse). */}
            <WideCard
              delay={300}
              className="lg:col-span-6"
              icon={<ValuePropIcon src="/figma/icons/icon-enterprise.svg" />}
              illustration="/figma/card-enterprise.svg"
              title={t("thesis.enterpriseReady")}
              description={t("thesis.enterpriseReadyDescription")}
            />
            <WideCard
              delay={400}
              className="lg:col-span-6"
              icon={<ValuePropIcon src="/figma/icons/icon-ownership.svg" />}
              illustration="/figma/card-ownership.svg"
              title={t("thesis.codeOwnership")}
              description={t("thesis.codeOwnershipDescription")}
            />
          </div>
        </div>
      </section>

      {/* ===================================================================
          2. FROM IDEA TO LAUNCH — steps + terminal. (Figma-only, hardcoded.)
         =================================================================== */}
      <section className="site-section">
        <div className="site-shell">
          <RevealBlock className="mb-10 max-w-2xl">
            <h2 className="site-section-title">From idea to launch</h2>
            <p className="site-section-copy mt-3 text-muted-foreground">
              We combine advanced automated workflows and human expertise to build and deploy.
            </p>
          </RevealBlock>

          <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
            <div className="flex flex-col gap-3">
              {LAUNCH_STEPS.map((step, index) => (
                <LaunchStep key={step.n} step={step} index={index} />
              ))}
            </div>
            <RevealBlock delay={200}>
              <PipelineTerminal />
            </RevealBlock>
          </div>
        </div>
      </section>

      {/* Premium: The Noon Difference - Comparison showcase */}
      <ComparisonShowcase
        title="Why Traditional Development Falls Short"
        subtitle="See how Noon transforms the way software gets built"
        items={[
          {
            label: "Requirements gathering",
            traditional: "→ Weeks of meetings and documentation\n→ Scope creep and miscommunication\n→ Delayed project kickoff",
            noon: "→ Maxwell analyzes your needs in real-time\n→ Generates technical spec automatically\n→ Start building within hours",
          },
          {
            label: "Prototyping",
            traditional: "→ Static mockups and wireframes\n→ Multiple revision cycles\n→ No working code until later phases",
            noon: "→ Functional prototype in 24-48 hours\n→ Real code you can test and validate\n→ Iterate with actual software",
          },
          {
            label: "Development",
            traditional: "→ Manual coding from scratch\n→ Inconsistent quality across team\n→ Slow feedback loops",
            noon: "→ AI-accelerated development pipeline\n→ Senior engineers validate every line\n→ Continuous delivery to production",
          },
          {
            label: "Delivery",
            traditional: "→ Big bang launches with high risk\n→ Last-minute bug fixes\n→ Handoff documentation gaps",
            noon: "→ Incremental delivery you can track\n→ Production-ready from day one\n→ Full ownership of your code",
          },
        ]}
      />

      {/* ===================================================================
          2.5 CONTACT NOON CTA — banner block con bg #131313 (custom, NO
              SiteCtaBlock — eso aplicaría el púrpura global). Estructura
              mirror del SiteCtaBlock pero con bg dark sólido.
         =================================================================== */}
      <section className="site-section-lg relative !pt-8 !pb-10 lg:!pt-10 lg:!pb-12">
        <div className="site-shell">
          <Link
            href={contactHref}
            className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div
              className="relative flex min-h-[168px] items-center justify-center overflow-hidden px-6 py-10 text-center sm:min-h-[176px] lg:px-12 lg:py-12"
              style={{ backgroundColor: "#131313" }}
            >
              <div className="relative z-10">
                <h2 className="site-section-title mb-4">Contact Noon</h2>
                <p className="site-section-copy mx-auto max-w-md text-white/75">
                  Have a project in mind? Start a conversation about what you want to build.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ===================================================================
          3. STATEMENT — scroll-driven word reveal (bigger, bolder, centrado).
              Las palabras del H2 arrancan muted y se iluminan progresivamente
              a foreground conforme scrolleás, mismo efecto que en /services.
         =================================================================== */}
      <ScrollLitAboutStatement />

      {/* ===================================================================
          4. ENGINEERING AT ITS CORE — code-editor mockup. (Figma-only, hardcoded.)
         =================================================================== */}
      <section className="site-section">
        <div className="site-shell">
          <RevealBlock className="relative overflow-hidden border border-foreground/10 bg-secondary/30 px-6 pt-10 lg:px-10 lg:pt-14">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
              <h2 className="site-section-title">
                Engineering at <span className="text-muted-foreground">its core.</span>
              </h2>
              <p className="site-section-copy text-muted-foreground">
                We do not deliver fragile prototypes. We develop digital products with industrial-grade architecture,
                100% in code, ready to support the growth of your infrastructure.
              </p>
            </div>
            <div className="mx-auto mt-10 max-w-3xl">
              <EngineDeploymentMockup />
            </div>
          </RevealBlock>
        </div>
      </section>

      {/* ===================================================================
          5. OPERATING MODEL vs BOUNDARIES — 2 columns.
             i18n: reuses operatingModel.* keys.
         =================================================================== */}
      <section className="site-section bg-secondary/30">
        <div className="site-shell">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            {/* Operating model */}
            <div className="border border-foreground/10 bg-card/80 p-6 lg:p-8">
              <Eyebrow>{t("operatingModel.eyebrow")}</Eyebrow>
              <div className="mt-8 space-y-8">
                {principles.map((principle, index) => (
                  <PrincipleItem key={principle.number} principle={principle} index={index} />
                ))}
              </div>
            </div>

            {/* Boundaries */}
            <div className="border border-foreground/10 bg-card/80 p-6 lg:p-8">
              <Eyebrow>{t("operatingModel.boundariesEyebrow")}</Eyebrow>
              <div className="mt-8 space-y-5">
                {notNoon.map((item, index) => (
                  <BoundaryItem key={index} text={item} index={index} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          6. TECH STACK — band of labels.
             i18n: reuses stack.* keys.
         =================================================================== */}
      <section id="technology" className="site-section">
        <div className="site-shell">
          <RevealBlock className="border border-foreground/10 px-6 py-8 lg:px-10 lg:py-10">
            <p className="site-section-copy max-w-3xl text-muted-foreground">{t("stack.description")}</p>
            {/* Figma brand-logo band — 2 rows of 5. Logos are light-stroked SVGs,
                so invert in light mode (invert) and keep as-is in dark (dark:invert-0). */}
            {/* Grid divisor: 5 cols × 2 rows con borde exterior + divisores
               internos. La grid tiene su propio borde perimetral (border) y
               cada celda agrega border-r y border-b para formar la rejilla;
               last-col y last-row no duplican el borde exterior. */}
            <div className="mt-8 grid grid-cols-5 border border-foreground/10">
              {TECH_LOGO_ROWS.flat().map((logo, i) => {
                const isLastCol = (i + 1) % 5 === 0;
                const isLastRow = i >= 5;
                return (
                  <div
                    key={logo.alt}
                    className={`flex h-28 items-center justify-center ${
                      !isLastCol ? "border-r border-foreground/10" : ""
                    } ${!isLastRow ? "border-b border-foreground/10" : ""}`}
                  >
                    <Image
                      src={logo.src}
                      width={40}
                      height={40}
                      alt={logo.alt}
                      unoptimized
                      // AWS tiene padding interno en el SVG (smile + texto no
                      // llenan el viewBox); lo scaleo +25% para compensar y
                      // matchear el peso visual de los demás isotipos.
                      className={`opacity-40 transition-opacity duration-300 hover:opacity-100 dark:invert ${
                        logo.alt === "AWS" ? "h-12 w-12" : "h-10 w-10"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </RevealBlock>
        </div>
      </section>

      <FaqSection />

      <SiteCtaBlock
        title={t("cta.headline")}
        description={t("cta.description")}
        blockHref={lp(siteRoutes.home)}
        className="!pt-8 !pb-10 lg:!pt-10 lg:!pb-12"
      />
      </div>
    </SitePageFrame>
  );
}

// ============================================================================
// DATA (Figma-only sections — hardcoded English copy matching the sandbox)
// ============================================================================

const LAUNCH_STEPS = [
  { n: "01", title: "Define project scope" },
  { n: "02", title: "Working software, not documentation" },
  { n: "03", title: "Explicit exclusions" },
  { n: "04", title: "Judgment, not blind execution" },
] as const;

// Tech stack: 10 isotipos uniformes 24×24 (simple-icons CDN). Sin wordmarks
// — todos son íconos cuadrados del mismo tamaño visual.
const TECH_LOGO_ROWS = [
  [
    { src: "/figma/logos/logo-typescript.svg", alt: "TypeScript" },
    { src: "/figma/logos/logo-supabase.svg", alt: "Supabase" },
    { src: "/figma/logos/logo-anthropic.svg", alt: "Anthropic" },
    { src: "/figma/logos/logo-cursor.svg", alt: "Cursor" },
    { src: "/figma/logos/logo-nodejs.svg", alt: "Node.js" },
  ],
  [
    { src: "/figma/logos/logo-vercel.svg", alt: "Vercel" },
    { src: "/figma/logos/logo-aws.svg", alt: "AWS" },
    { src: "/figma/logos/logo-openai.svg", alt: "OpenAI" },
    { src: "/figma/logos/logo-nextjs.svg", alt: "Next.js" },
    { src: "/figma/logos/logo-github.svg", alt: "GitHub" },
  ],
] as const;

// ============================================================================
// SHARED PRIMITIVES
// ============================================================================

function RevealBlock({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.15 });
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="liquid-glass-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: siteTones.brand.accent }} />
      {children}
    </span>
  );
}

// ValuePropIcon — renders the dark-bg + white-stroke 32×32 Figma icon SVGs
// (icon-feature, icon-clear-process, icon-ai, icon-enterprise, icon-ownership).
// Each SVG already has its own dark rect background, so we invert in light
// mode to keep contrast and leave the dark mode alone.
function ValuePropIcon({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={32}
      height={32}
      unoptimized
      className="h-8 w-8 invert dark:invert-0"
    />
  );
}

// ============================================================================
// VALUE PROP CARDS
// ============================================================================

function ValueCard({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.2 });
  return (
    <div
      ref={ref}
      className={`relative overflow-hidden border border-foreground/10 bg-card/80 transition-all duration-700 hover:border-foreground/20 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function FileTreeMockup() {
  return (
    <div className="mt-auto overflow-hidden border border-foreground/10 bg-foreground/[0.03] pt-3">
      <div className="flex items-center justify-between border-b border-foreground/10 px-4 pb-3">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-muted-foreground/70">
          your-project
        </span>
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        </div>
      </div>
      <div className="space-y-1.5 p-4 font-mono text-xs leading-5 text-muted-foreground/70">
        <div className="text-foreground">your-project/</div>
        <div className="ml-3.5">├── src/</div>
        <div className="ml-7">│ ├── components/</div>
        <div className="ml-7">│ └── lib/</div>
        <div className="ml-3.5">└── package.json</div>
      </div>
    </div>
  );
}

function CompactCard({
  icon,
  title,
  description,
  badge,
  tone,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  tone: (typeof siteTones)[keyof typeof siteTones];
  delay?: number;
}) {
  const { ref, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.2 });
  return (
    <div
      ref={ref}
      className={`relative flex flex-col justify-between border border-foreground/10 bg-card/80 p-6 transition-all duration-700 hover:border-foreground/20 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Figma sandbox: the icon renders standalone (the SVG carries its own
         dark rect + white stroke). No secondary container around it. */}
      <div className="mb-5 flex items-start justify-between">
        {icon}
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-muted-foreground/70">{badge}</span>
      </div>
      <div className="flex-1">
        <h3 className="site-card-title">{title}</h3>
        <p className="site-card-copy mt-2 text-muted-foreground">{description}</p>
      </div>
      <div className="mt-5 flex h-8 items-center gap-2 border border-foreground/10 px-3">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.accent }} />
        <span className="text-xs text-muted-foreground">Progress: defined → delivered</span>
      </div>
    </div>
  );
}

function WideCard({
  icon,
  illustration,
  title,
  description,
  className = "",
  delay = 0,
}: {
  icon: React.ReactNode;
  illustration: string;
  title: string;
  description: string;
  className?: string;
  delay?: number;
}) {
  const { ref, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.2 });
  return (
    <div
      ref={ref}
      className={`relative flex items-start gap-5 overflow-hidden border border-foreground/10 bg-card/80 p-6 transition-all duration-700 hover:border-foreground/20 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex-1">
        {icon}
        <h3 className="site-card-title mt-4">{title}</h3>
        <p className="site-card-copy mt-2 text-muted-foreground">{description}</p>
      </div>
      {/* Figma sandbox: large card-*.svg illustration on the right (96×96).
         Light-stroked, so invert in light mode and leave dark mode untouched. */}
      <div className="flex h-24 w-24 shrink-0 items-center justify-center">
        <Image
          src={illustration}
          alt=""
          width={96}
          height={96}
          unoptimized
          className="h-auto w-full opacity-80 invert dark:invert-0"
        />
      </div>
    </div>
  );
}

// ============================================================================
// FROM IDEA TO LAUNCH
// ============================================================================

function LaunchStep({ step, index }: { step: { n: string; title: string }; index: number }) {
  const { ref, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.3 });
  return (
    <div
      ref={ref}
      className={`flex items-center gap-4 border border-foreground/10 bg-card/80 px-4 py-3.5 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <span className="font-mono text-sm text-muted-foreground/70">{step.n}</span>
      <span className="text-sm text-foreground">{step.title}</span>
    </div>
  );
}

function PipelineTerminal() {
  const lines: { text: string; tone: "command" | "log" | "muted" | "success" | "info" }[] = [
    { text: "$ npx create-noon-app@latest init", tone: "command" },
    { text: "→ [Maxwell AI] Analyzing system architecture requirements...", tone: "log" },
    {
      text: "Direction is defined and agreed before production code is written. Ambiguity is resolved at the start, not during development.",
      tone: "muted",
    },
    { text: "✔ Direction is defined and agreed before production code.", tone: "success" },
    { text: "✔ Core pipeline generated in workspace.json", tone: "success" },
    { text: "🚀 Initializing git repository... Done.", tone: "info" },
  ];

  const toneClass = (tone: (typeof lines)[number]["tone"]) => {
    switch (tone) {
      case "command":
        return "text-foreground";
      case "muted":
        return "text-muted-foreground/60";
      default:
        return "text-muted-foreground";
    }
  };
  const toneColor = (tone: (typeof lines)[number]["tone"]) => {
    switch (tone) {
      case "log":
        return siteTones.gateway.accent;
      case "success":
        return siteTones.gateway.accent;
      case "info":
        return siteTones.services.accent;
      default:
        return undefined;
    }
  };

  return (
    <div className="overflow-hidden border border-foreground/10 bg-foreground/[0.04] dark:bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-2.5">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-muted-foreground/70">
          noon-pipeline ~ bash
        </span>
        <span className="font-mono text-[0.625rem] text-muted-foreground/40">●●●</span>
      </div>
      <div className="flex flex-col gap-2 p-5 font-mono text-xs leading-5">
        {lines.map((line, i) => (
          <div key={i} className={toneClass(line.tone)} style={{ color: toneColor(line.tone) }}>
            {line.text}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-foreground/10 px-4 py-2.5">
        <span className="font-mono text-[0.625rem] text-muted-foreground/60">ACTIVE_FLOW: STEP_1/4</span>
        <span className="font-mono text-[0.625rem] text-muted-foreground/60">maxwell.noon.dev</span>
      </div>
    </div>
  );
}

// ============================================================================
// ENGINEERING AT ITS CORE — Maxwell Engine Deployment mockup
// ============================================================================

function EngineDeploymentMockup() {
  const logs = [
    { t: "00:00.1", color: undefined, msg: "Initializing Maxwell Engine v2.6.0…" },
    { t: "00:00.4", color: siteTones.brandStructural.accent, msg: "→  Scanning project structure (142 files)" },
    { t: "00:01.2", color: siteTones.brandStructural.accent, msg: "→  Running type-safety checks…" },
    { t: "00:02.1", color: siteTones.gateway.accent, msg: "✓  TypeScript strict — 0 errors" },
    { t: "00:02.8", color: siteTones.brandStructural.accent, msg: "→  Building production artifacts…" },
    { t: "00:04.3", color: siteTones.gateway.accent, msg: "✓  Build complete  2.4 MB → 1.1 MB gzip" },
    { t: "00:04.9", color: siteTones.brandStructural.accent, msg: "→  Deploying to production edge…" },
    { t: "00:06.1", color: siteTones.gateway.accent, msg: "✓  Deployment successful · noon.dev" },
  ];

  const tree = [
    "project-repo/",
    "├ src/",
    "│  ├ app/",
    "│  ├ components/",
    "│  └ lib/",
    "├ public/",
    "├ package.json",
    "├ tsconfig.json",
    "└ next.config.ts",
  ];

  const tags = ["Architecture", "Type-safety", "Security"];

  return (
    <div className="overflow-hidden border border-b-0 border-foreground/10 bg-background/60 dark:bg-[#090909]">
      {/* Title bar */}
      <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </div>
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground/50">
          Interactive Workspace
        </span>
      </div>

      {/* Header: title + QA score */}
      <div className="flex items-center justify-between gap-4 border-b border-foreground/10 px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Maxwell Engine Deployment</span>
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[0.625rem]"
              style={{
                color: siteTones.brandStructural.accent,
                backgroundColor: siteTones.brandStructural.mutedSurface,
              }}
            >
              #NOON-2026
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 bg-foreground/5 px-2 py-0.5 font-mono text-[0.625rem] text-muted-foreground/70"
              >
                <span style={{ color: siteTones.gateway.accent }}>✓</span>
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div
          className="flex shrink-0 items-baseline gap-1 px-3 py-1.5"
          style={{ backgroundColor: siteTones.gateway.mutedSurface }}
        >
          <span className="font-mono text-[0.625rem]" style={{ color: siteTones.gateway.accent }}>
            QA
          </span>
          <span className="font-mono text-xl font-bold leading-none" style={{ color: siteTones.gateway.accent }}>
            98
          </span>
          <span className="font-mono text-[0.625rem]" style={{ color: siteTones.gateway.accent }}>
            / 100
          </span>
        </div>
      </div>

      {/* Body: log + file tree */}
      <div className="flex">
        <div className="flex-1 overflow-hidden px-4 py-3">
          <div className="space-y-1.5 font-mono text-[0.6875rem] leading-4">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="shrink-0 text-muted-foreground/30">[{log.t}]</span>
                <span style={{ color: log.color }} className={log.color ? "" : "text-muted-foreground/60"}>
                  {log.msg}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden w-44 shrink-0 border-l border-foreground/10 px-4 py-3 sm:block">
          <div className="space-y-1 font-mono text-[0.625rem] leading-4 text-muted-foreground/50">
            {tree.map((node, i) => (
              <div key={i}>{node}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// OPERATING MODEL vs BOUNDARIES
// ============================================================================

function PrincipleItem({ principle, index }: { principle: { number: string; title: string; description: string }; index: number }) {
  const { ref, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.3 });
  return (
    <div
      ref={ref}
      className={`flex items-start gap-4 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/20 font-mono text-sm text-muted-foreground">
        {principle.number}
      </span>
      <div>
        <h3 className="site-card-title">{principle.title}</h3>
        <p className="site-card-copy mt-1.5 text-muted-foreground">{principle.description}</p>
      </div>
    </div>
  );
}

function BoundaryItem({ text, index }: { text: string; index: number }) {
  const { ref, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.3 });
  return (
    <div
      ref={ref}
      className={`flex items-center gap-4 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-foreground/15 bg-secondary/40">
        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="text-muted-foreground" />
        </svg>
      </span>
      <span className="site-card-copy text-foreground/85">{text}</span>
    </div>
  );
}

// ============================================================================
// TECH STACK
// ============================================================================

// (TechItem removed — tech stack now renders Figma brand logos, see TECH_LOGO_ROWS)

// ============================================================================
// STATEMENT — static highlight (NO scroll animation). El texto se renderiza
// fijo: primera parte muted, parte final ("problems with code.") foreground.
// ============================================================================

function ScrollLitAboutStatement() {
  return (
    <section className="site-section relative overflow-hidden">
      <GridBackdrop mask="radial-gradient(ellipse 60% 70% at 50% 50%, #000 12%, transparent 72%)" />
      <div className="site-shell relative">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 py-8 text-center lg:py-12">
          <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-foreground">
            Actual results
          </span>
          <h2 className="site-hero-title">
            <span className="text-foreground/30">
              We don&apos;t build software. We solve business
            </span>{" "}
            <span className="text-foreground">problems with code.</span>
          </h2>
          <p className="site-section-copy max-w-md text-muted-foreground">
            Let Maxwell audit your idea and generate a preliminary technical roadmap in minutes. No commitments, just
            real engineering.
          </p>
        </div>
      </div>
    </section>
  );
}
