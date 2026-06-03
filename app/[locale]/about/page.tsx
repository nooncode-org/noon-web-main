"use client";

import dynamic from "next/dynamic";
import { ArrowRight, Check, Circle, ClipboardList, Code2, FileCode2, Folder, Globe, Layers, LayoutDashboard, Milestone, Minus, Receipt, Rocket, Route, ShieldCheck, Smartphone, Sparkles, Target, UserCheck } from "lucide-react";
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
import { MaxwellStudioPreview } from "@/components/sections/maxwell-studio-preview";

const LOCALES = ["en", "es", "fr", "de"];

// ── "Why Noon" comparison (traditional vs Noon) ───────────────────────────
const COMPARISON_TITLE = "Why traditional development falls short";
const COMPARISON_SUBTITLE = "See how Noon transforms the way software gets built";
const COMPARISON_ITEMS = [
  {
    label: "Requirements",
    traditional: "→ Weeks of meetings and documentation\n→ Scope creep and miscommunication\n→ Delayed project kickoff",
    noon: "→ Maxwell turns your need into a clear scope\n→ What's in and out, agreed up front\n→ Scope before execution",
  },
  {
    label: "Prototyping",
    traditional: "→ Static mockups and wireframes\n→ Multiple revision cycles\n→ No working code until later phases",
    noon: "→ A working prototype you can actually use\n→ Real code, not slides\n→ You iterate on actual software",
  },
  {
    label: "Development",
    traditional: "→ Manual coding from scratch\n→ Inconsistent quality across the team\n→ Slow feedback loops",
    noon: "→ AI-accelerated, senior engineers review the work\n→ Production-minded code\n→ Judgment, not blind execution",
  },
  {
    label: "Delivery",
    traditional: "→ Big-bang launches with high risk\n→ Last-minute bug fixes\n→ Handoff documentation gaps",
    noon: "→ Incremental delivery you can track\n→ Working software, not documentation\n→ Ownership aligned with your engagement model",
  },
] as const;

// Per-dimension iconography for the comparison fallback (mirrors the icons in
// the client ComparisonShowcase so there's no flash on hydration).
const DIMENSION_ICONS: Record<string, typeof Check> = {
  Requirements: ClipboardList,
  Prototyping: Layers,
  Development: Code2,
  Delivery: Rocket,
};

// ── "What working with Noon looks like" — qualitative credibility (the #1 gap
// vs Vercel/Linear). Built from REAL, approved commitments (FAQ + brand
// principles), not fabricated testimonials/metrics (owner chose qualitative).
const COMMITMENTS: { icon: typeof Target; title: string; body: string }[] = [
  {
    icon: Target,
    title: "Scoped before we build",
    body: "Maxwell clarifies the real problem and the exact build scope before any production code is written.",
  },
  {
    icon: Code2,
    title: "Real code, no lock-in",
    body: "Everything ships as real code on a standard stack — never low-code you can't move off.",
  },
  {
    icon: UserCheck,
    title: "Senior engineers own it",
    body: "AI accelerates the work, but a senior engineer reviews it and owns the judgment.",
  },
  {
    icon: Receipt,
    title: "Transparent pricing",
    body: "A clear quote after the scoping phase — no hourly surprises, no hidden fees.",
  },
  {
    icon: Milestone,
    title: "Incremental delivery",
    body: "You get working software in phases and can track progress — not a big-bang reveal.",
  },
  {
    icon: ShieldCheck,
    title: "Your data stays yours",
    body: "Ownership follows the engagement model, and your data remains yours.",
  },
];

// ── "What we build" — Noon's delivery areas (real, previously-unrendered
// services.serviceTypes from messages/en.json): concrete technical domains +
// real example types. The "use-case grid" pattern, adapted to a services firm.
const WHAT_WE_BUILD: { icon: typeof Globe; title: string; description: string; examples: [string, string, string] }[] = [
  {
    icon: Sparkles,
    title: "AI & Automation",
    description:
      "Intelligent assistants, workflow automation, and AI-powered tooling for teams that need speed without losing operational control.",
    examples: ["AI assistants", "Automated workflows", "Smart integrations"],
  },
  {
    icon: Globe,
    title: "Web Solutions",
    description:
      "From customer-facing experiences to internal platforms, built as real software with production-grade architecture.",
    examples: ["Web platforms", "Dashboards", "Portals"],
  },
  {
    icon: Smartphone,
    title: "Mobile Solutions",
    description:
      "Native and cross-platform mobile applications focused on clear flows and operational reliability.",
    examples: ["iOS apps", "Android apps", "Cross-platform"],
  },
  {
    icon: Code2,
    title: "Custom Software",
    description:
      "Software shaped around your internal logic and non-standard workflows when generic systems stop being useful.",
    examples: ["Internal tools", "Custom integrations", "Business systems"],
  },
];

// Compact, on-brand product-UI mockups — one per delivery area, so each domain
// SHOWS the kind of interface it produces (not just an icon). Illustrative
// product UI (sample data), single-accent, theme-aware.
function DomainMockup({ kind }: { kind: string }) {
  const frame = "overflow-hidden rounded-[8px] border border-foreground/10 bg-background/60";
  if (kind === "AI & Automation") {
    return (
      <div className={`${frame} p-3`}>
        <div className="mb-2 flex items-center gap-1.5">
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-primary"
            style={{ backgroundColor: "rgba(18,0,197,0.14)" }}
          >
            <Sparkles className="h-2.5 w-2.5" />
          </span>
          <span className="text-[9px] font-medium text-foreground/80">Assistant</span>
        </div>
        <div className="flex justify-end">
          <span className="max-w-[82%] rounded-[6px] border border-primary/30 bg-primary/10 px-2 py-1 text-[9px] leading-snug text-foreground/85">
            Automate the weekly ops report
          </span>
        </div>
        <div className="mt-1.5 flex justify-start">
          <span className="max-w-[88%] rounded-[6px] border border-foreground/10 bg-card/60 px-2 py-1 text-[9px] leading-snug text-muted-foreground">
            On it — pulling the data and drafting it now.
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 rounded-[6px] border border-foreground/10 px-2 py-1.5">
          <span className="h-1 w-1 rounded-full bg-primary" />
          <span className="text-[9px] text-muted-foreground/55">Ask the assistant…</span>
        </div>
      </div>
    );
  }
  if (kind === "Web Solutions") {
    return (
      <div className={`${frame} p-3`}>
        <div className="grid grid-cols-3 gap-1.5">
          {([["Users", "1,284"], ["Revenue", "$48k"], ["Active", "312"]] as const).map(([l, v]) => (
            <div key={l} className="rounded-[6px] border border-foreground/10 px-1.5 py-1">
              <p className="text-[6.5px] uppercase tracking-wide text-muted-foreground/60">{l}</p>
              <p className="text-[11px] font-semibold leading-tight text-foreground">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex h-12 items-end gap-1">
          {[40, 64, 48, 80, 56, 72, 92, 68].map((barH, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm"
              style={{ height: `${barH}%`, backgroundColor: i === 6 ? "#1200c5" : "rgba(18,0,197,0.28)" }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (kind === "Mobile Solutions") {
    return (
      <div className="flex justify-center py-1">
        <div className="w-[92px] overflow-hidden rounded-[12px] border border-foreground/15 bg-background/60 px-2 pb-2 pt-1.5">
          <div className="mx-auto mb-2 h-1 w-7 rounded-full bg-foreground/20" />
          <div className="mb-2 h-1.5 w-14 rounded-full bg-foreground/30" />
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="mb-1 flex items-center gap-1.5 rounded-[5px] border border-foreground/10 px-1.5 py-1.5 last:mb-0"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-primary" : "bg-primary/25"}`} />
              <span className="h-1 flex-1 rounded-full bg-foreground/15" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  // Custom Software
  return (
    <div className={frame}>
      <div className="flex items-center gap-1.5 border-b border-foreground/10 px-2.5 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
        <span className="ml-1 font-mono text-[8px] text-muted-foreground/60">workflow</span>
      </div>
      <div className="divide-y divide-foreground/10">
        {([["Intake", "Done"], ["Approval", "Active"], ["Dispatch", "Queued"]] as const).map(([l, s]) => (
          <div key={l} className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-[9px] text-foreground/80">{l}</span>
            <span className="inline-flex items-center gap-1 text-[8px]">
              <span className={`h-1.5 w-1.5 rounded-full ${s === "Active" ? "bg-primary" : "bg-foreground/25"}`} />
              <span className={s === "Active" ? "text-primary" : "text-muted-foreground/55"}>{s}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function toPoints(block: string): string[] {
  return block.split("\n").map((l) => l.replace(/^→\s*/, "").trim()).filter(Boolean);
}

// Static, content-bearing fallback rendered on the server / until the
// client chunk loads (the animated ComparisonShowcase is client-only).
function ComparisonFallback() {
  return (
    <section className="site-section relative overflow-hidden">
      <div className="site-shell relative">
        <div className="mx-auto mb-10 max-w-2xl text-center lg:mb-12">
          <span className="liquid-glass-pill mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Why Noon
          </span>
          <h2 className="site-section-title mb-3">{COMPARISON_TITLE}</h2>
          <p className="site-section-copy mx-auto max-w-xl text-muted-foreground">{COMPARISON_SUBTITLE}</p>
        </div>
        <div className="overflow-hidden border border-foreground/10 bg-card/40">
          <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-foreground/10">
            <div className="p-6 lg:p-8">
              <p className="mb-6 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-[6px] border border-foreground/15 bg-secondary/40">
                  <Minus className="h-3 w-3" />
                </span>
                Traditional approach
              </p>
              <div className="space-y-5">
                {COMPARISON_ITEMS.map((item) => {
                  const DimIcon = DIMENSION_ICONS[item.label] ?? Circle;
                  return (
                  <div key={item.label}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
                      <DimIcon className="h-3 w-3" strokeWidth={1.75} />
                      {item.label}
                    </p>
                    <ul className="space-y-1.5">
                      {toPoints(item.traditional).map((p, i) => (
                        <li key={i} className="flex gap-2 text-sm leading-snug text-muted-foreground">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-primary/[0.03] p-6 lg:p-8">
              <p className="mb-6 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-primary">
                <span className="flex h-5 w-5 items-center justify-center rounded-[6px] text-primary" style={{ backgroundColor: "rgba(18,0,197,0.12)" }}>
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                With Noon
              </p>
              <div className="space-y-5">
                {COMPARISON_ITEMS.map((item) => {
                  const DimIcon = DIMENSION_ICONS[item.label] ?? Circle;
                  return (
                  <div key={item.label}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-primary/80">
                      <DimIcon className="h-3 w-3" strokeWidth={1.75} />
                      {item.label}
                    </p>
                    <ul className="space-y-1.5">
                      {toPoints(item.noon).map((p, i) => (
                        <li key={i} className="flex gap-2 text-sm leading-snug text-foreground/90">
                          <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-primary" style={{ backgroundColor: "rgba(18,0,197,0.12)" }}>
                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          </span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const ComparisonShowcase = dynamic(
  () => import("@/components/sections/premium").then((m) => m.ComparisonShowcase),
  { ssr: false, loading: () => <ComparisonFallback /> }
);

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
                className="group site-primary-action inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
              >
                {t("hero.startWithMaxwell")}
                <ArrowRight className="w-4 h-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
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
          1.5 WHAT WE BUILD — delivery areas (real serviceTypes content). The
              "use-case grid" pattern, adapted: concrete domains + examples.
         =================================================================== */}
      <section className="site-section">
        <div className="site-shell">
          <RevealBlock className="mb-8 max-w-2xl lg:mb-10">
            <span className="site-meta-label mb-4 inline-flex items-center gap-3 font-mono text-muted-foreground">
              <span className="h-px w-8 bg-foreground/30" />
              Delivery areas
            </span>
            <h2 className="site-section-title">
              Four types of software <span className="text-muted-foreground">we deliver.</span>
            </h2>
          </RevealBlock>
          <RevealBlock className="overflow-hidden border border-foreground/10">
            <div className="grid gap-px bg-foreground/10 sm:grid-cols-2">
              {WHAT_WE_BUILD.map((d) => {
                const Icon = d.icon;
                return (
                  <div key={d.title} className="flex flex-col bg-background p-6 lg:p-8">
                    <DomainMockup kind={d.title} />
                    <div className="mb-3 mt-5 flex items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-primary"
                        style={{ backgroundColor: "rgba(18,0,197,0.10)" }}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <h3 className="text-base font-medium text-foreground">{d.title}</h3>
                    </div>
                    <p className="text-sm leading-snug text-muted-foreground">{d.description}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {d.examples.map((ex) => (
                        <span
                          key={ex}
                          className="inline-flex items-center rounded-full border border-foreground/10 bg-card/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </RevealBlock>
        </div>
      </section>

      {/* ===================================================================
          THE PRODUCT — Maxwell scoping studio (faithful product preview).
         =================================================================== */}
      <section className="site-section">
        <div className="site-shell">
          <RevealBlock className="mb-8 max-w-2xl lg:mb-10">
            <span className="site-meta-label mb-4 inline-flex items-center gap-3 font-mono text-muted-foreground">
              <span className="h-px w-8 bg-foreground/30" />
              The product
            </span>
            <h2 className="site-section-title">
              Every project starts in <span className="text-muted-foreground">Maxwell.</span>
            </h2>
            <p className="site-section-copy mt-3 text-muted-foreground">
              You describe what you want to build. Maxwell turns it into a clear scope and a
              working prototype you can use and approve — before any production code is written.
            </p>
          </RevealBlock>
          <RevealBlock delay={150}>
            <MaxwellStudioPreview />
          </RevealBlock>
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
              <DeliveryTimeline />
            </RevealBlock>
          </div>
        </div>
      </section>

      {/* Premium: The Noon Difference — comparison showcase (client-only; the
         animated Noon column resolves each dimension. Static fallback on SSR.) */}
      <ComparisonShowcase title={COMPARISON_TITLE} subtitle={COMPARISON_SUBTITLE} items={[...COMPARISON_ITEMS]} />

      {/* ===================================================================
          Enrichment — "What working with Noon looks like": qualitative
          credibility / what-to-expect from real, approved commitments. Honest
          trust layer (no fabricated testimonials or metrics).
         =================================================================== */}
      <section className="site-section">
        <div className="site-shell">
          <RevealBlock className="mb-8 max-w-2xl lg:mb-10">
            <span className="site-meta-label mb-4 inline-flex items-center gap-3 font-mono text-muted-foreground">
              <span className="h-px w-8 bg-foreground/30" />
              How we work
            </span>
            <h2 className="site-section-title">What working with Noon looks like.</h2>
          </RevealBlock>
          <RevealBlock className="overflow-hidden border border-foreground/10">
            <div className="grid gap-px bg-foreground/10 sm:grid-cols-2 lg:grid-cols-3">
              {COMMITMENTS.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.title} className="bg-background p-6 lg:p-7">
                    <span
                      className="mb-4 flex h-8 w-8 items-center justify-center rounded-[8px] text-primary"
                      style={{ backgroundColor: "rgba(18,0,197,0.10)" }}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <h3 className="text-[15px] font-medium leading-snug text-foreground">{c.title}</h3>
                    <p className="mt-2 text-sm leading-snug text-muted-foreground">{c.body}</p>
                  </div>
                );
              })}
            </div>
          </RevealBlock>
        </div>
      </section>

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
            <div className="mx-auto mt-10 max-w-4xl">
              <SystemArchitecture />
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
              <div className="mt-8">
                {principles.map((principle, index) => (
                  <PrincipleItem
                    key={principle.number}
                    principle={principle}
                    index={index}
                    last={index === principles.length - 1}
                  />
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
            {/* Stack & integrations — grouped by layer (real recognizable logos
               + names). Hairline-divided rows; SVGs are dark → dark:invert. */}
            <div className="mt-8 divide-y divide-foreground/10 overflow-hidden border border-foreground/10">
              {TECH_STACK_GROUPS.map((group) => (
                <div
                  key={group.label}
                  className="flex flex-col gap-3 bg-background px-5 py-4 sm:flex-row sm:items-center sm:gap-6 lg:px-6"
                >
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70 sm:w-40">
                    {group.label}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
                    {group.logos.map((logo) => (
                      <span key={logo.alt} className="inline-flex items-center gap-2">
                        <Image
                          src={logo.src}
                          width={28}
                          height={28}
                          alt={logo.alt}
                          unoptimized
                          className="h-5 w-5 opacity-50 transition-opacity duration-300 hover:opacity-100 dark:invert"
                        />
                        <span className="text-[12.5px] text-muted-foreground">{logo.alt}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </RevealBlock>
        </div>
      </section>

      <FaqSection />

      <SiteCtaBlock
        title={t("cta.headline")}
        description={t("cta.description")}
        blockHref={lp(siteRoutes.maxwellStudio)}
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

// Tech stack & integrations — Noon's real, approved stack, grouped by layer so
// the logos read as a real engineering stack (recognizable isotypes + names),
// not a loose icon wall. simple-icons SVGs are dark → dark:invert in dark mode.
const TECH_STACK_GROUPS: { label: string; logos: { src: string; alt: string }[] }[] = [
  {
    label: "Languages",
    logos: [
      { src: "/figma/logos/logo-typescript.svg", alt: "TypeScript" },
      { src: "/figma/logos/logo-python.svg", alt: "Python" },
    ],
  },
  {
    label: "Frontend",
    logos: [
      { src: "/figma/logos/logo-react.svg", alt: "React" },
      { src: "/figma/logos/logo-nextjs.svg", alt: "Next.js" },
      { src: "/figma/logos/logo-tailwind.svg", alt: "Tailwind CSS" },
      { src: "/figma/logos/logo-flutter.svg", alt: "Flutter" },
    ],
  },
  {
    label: "Backend & data",
    logos: [
      { src: "/figma/logos/logo-nodejs.svg", alt: "Node.js" },
      { src: "/figma/logos/logo-postgresql.svg", alt: "PostgreSQL" },
      { src: "/figma/logos/logo-supabase.svg", alt: "Supabase" },
    ],
  },
  {
    label: "Platform & services",
    logos: [
      { src: "/figma/logos/logo-vercel.svg", alt: "Vercel" },
      { src: "/figma/logos/logo-openai.svg", alt: "OpenAI" },
      { src: "/figma/logos/logo-stripe.svg", alt: "Stripe" },
    ],
  },
];

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
      <div className="space-y-1 p-4 font-mono text-xs">
        {[
          { depth: 0, name: "your-project/", kind: "dir" },
          { depth: 1, name: "src/", kind: "dir" },
          { depth: 2, name: "app/", kind: "dir" },
          { depth: 2, name: "components/", kind: "dir" },
          { depth: 2, name: "lib/", kind: "dir" },
          { depth: 1, name: "package.json", kind: "file" },
        ].map((n) => (
          <div key={n.name} className="flex items-center gap-2" style={{ paddingLeft: n.depth * 16 }}>
            {n.kind === "dir" ? (
              <Folder className="h-3.5 w-3.5 shrink-0 text-primary/70" strokeWidth={1.75} />
            ) : (
              <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
            )}
            <span
              className={
                n.kind === "file"
                  ? "text-muted-foreground/70"
                  : n.depth === 0
                    ? "font-medium text-foreground"
                    : "text-foreground/80"
              }
            >
              {n.name}
            </span>
          </div>
        ))}
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

// ── "From idea to launch" — incremental delivery timeline ───────────────────
// Replaces the old fictional `npx create-noon-app` CLI (Noon is not an npm
// package). Honest + tangible: the running example project (order-tracking
// portal) shipping in phases, reinforcing the approved "incremental delivery
// you can track" principle. Illustrative product UI — no fabricated metrics.
const DELIVERY_PHASES: { n: string; name: string; note: string; status: "shipped" | "active" | "planned" }[] = [
  { n: "01", name: "Auth + order list", note: "login · scoped per client", status: "shipped" },
  { n: "02", name: "Live status + history", note: "Supabase Realtime · search", status: "shipped" },
  { n: "03", name: "Alerts + admin view", note: "email + SMS · Noon ops", status: "active" },
  { n: "04", name: "Launch", note: "live in production", status: "planned" },
];

const STATUS_META: Record<"shipped" | "active" | "planned", { label: string; cls: string }> = {
  shipped: { label: "Shipped", cls: "border-foreground/15 text-muted-foreground" },
  active: { label: "In progress", cls: "border-primary/30 text-primary" },
  planned: { label: "Planned", cls: "border-foreground/10 text-muted-foreground/50" },
};

function DeliveryTimeline() {
  const { ref, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.2 });
  const last = DELIVERY_PHASES.length - 1;
  return (
    <div ref={ref} className="overflow-hidden border border-foreground/10 bg-background/60 dark:bg-[#090909]">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-foreground/10 px-5 py-2.5">
        <Milestone className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.75} />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60">
          Incremental delivery
        </span>
        <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground/40 sm:block">
          order-tracking portal
        </span>
      </div>

      {/* phases on a vertical timeline */}
      <div className="px-5 py-2">
        {DELIVERY_PHASES.map((p, i) => {
          const s = STATUS_META[p.status];
          return (
            <div
              key={p.n}
              className={`flex items-center gap-4 py-3.5 transition-all duration-700 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              {/* timeline node + spine */}
              <div className="relative flex w-4 shrink-0 items-center justify-center self-stretch">
                <span
                  aria-hidden
                  className={`absolute left-1/2 w-px -translate-x-1/2 bg-foreground/15 ${
                    i === 0 ? "bottom-0 top-1/2" : i === last ? "bottom-1/2 top-0" : "inset-y-0"
                  }`}
                />
                {p.status === "active" ? (
                  <span className="relative z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary ring-4 ring-background dark:ring-[#090909]">
                    <span className="h-1 w-1 rounded-full bg-primary-foreground" />
                  </span>
                ) : p.status === "shipped" ? (
                  <span className="relative z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-foreground/70 ring-4 ring-background dark:ring-[#090909]">
                    <Check className="h-2 w-2 text-background" strokeWidth={4} />
                  </span>
                ) : (
                  <span className="relative z-10 h-2.5 w-2.5 rounded-full border border-foreground/30 bg-background ring-4 ring-background dark:bg-[#090909] dark:ring-[#090909]" />
                )}
              </div>

              {/* phase label */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground/45">{p.n}</span>
                  <span className="text-[13px] font-medium leading-tight text-foreground">{p.name}</span>
                </div>
                <p className="mt-0.5 font-mono text-[10px] leading-tight text-muted-foreground/60">{p.note}</p>
              </div>

              {/* status pill */}
              <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9.5px] ${s.cls}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// ENGINEERING AT ITS CORE — system architecture of a Noon-built product.
// Real runtime layers (surface → application → typed core → data) on Noon's
// actual stack (real brand logos), plus the engineering defaults that keep it
// production-grade. Replaces the old fictional "Maxwell Engine v2.6.0 / QA
// 98/100" deployment mock — a fabricated metric and a product that doesn't
// exist. No invented numbers; theme-aware; flush-bottom so it reads as a
// screen embedded in the panel.
// ============================================================================

type ArchNode = { name: string; logo?: string; icon?: typeof Globe };

const ARCH_LAYERS: { n: string; label: string; meta: string; nodes: ArchNode[] }[] = [
  {
    n: "01",
    label: "Surface",
    meta: "web · mobile · admin",
    nodes: [
      { name: "Web app", icon: Globe },
      { name: "Mobile", icon: Smartphone },
      { name: "Admin", icon: LayoutDashboard },
    ],
  },
  {
    n: "02",
    label: "Application",
    meta: "server-rendered · edge-deployed",
    nodes: [
      { name: "Next.js", logo: "/figma/logos/logo-nextjs.svg" },
      { name: "Vercel", logo: "/figma/logos/logo-vercel.svg" },
    ],
  },
  {
    n: "03",
    label: "Typed core",
    meta: "end-to-end TypeScript · server actions",
    nodes: [
      { name: "TypeScript", logo: "/figma/logos/logo-typescript.svg" },
      { name: "Node.js", logo: "/figma/logos/logo-nodejs.svg" },
    ],
  },
  {
    n: "04",
    label: "Data & services",
    meta: "Postgres · auth · realtime · storage",
    nodes: [
      { name: "Supabase", logo: "/figma/logos/logo-supabase.svg" },
      { name: "AWS", logo: "/figma/logos/logo-aws.svg" },
    ],
  },
];

const ARCH_DEFAULTS = [
  "Typed end-to-end",
  "Senior-engineer review",
  "Incremental delivery",
  "Versioned in Git",
] as const;

function ArchChip({ node }: { node: ArchNode }) {
  const Icon = node.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-foreground/10 bg-card/70 px-2.5 py-1.5">
      {node.logo ? (
        <Image src={node.logo} width={16} height={16} alt="" unoptimized className="h-4 w-4 opacity-90 dark:invert" />
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
      ) : null}
      <span className="text-[12px] font-medium text-foreground/85">{node.name}</span>
    </span>
  );
}

function SystemArchitecture() {
  const { ref, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.2 });
  const last = ARCH_LAYERS.length - 1;
  return (
    <div
      ref={ref}
      className="overflow-hidden border border-b-0 border-foreground/10 bg-background/60 dark:bg-[#090909]"
    >
      {/* header */}
      <div className="flex items-center gap-2 border-b border-foreground/10 px-5 py-2.5">
        <Layers className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.75} />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60">
          System architecture
        </span>
        <span className="ml-auto hidden font-mono text-[10px] tracking-wide text-muted-foreground/40 sm:block">
          request flows top → down
        </span>
      </div>

      {/* runtime layers — components tap off a vertical request spine */}
      <div className="px-5 py-1">
        {ARCH_LAYERS.map((layer, i) => (
          <div
            key={layer.n}
            className={`flex flex-col gap-3 py-4 transition-all duration-700 sm:flex-row sm:items-center sm:gap-4 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            {/* spine + node */}
            <div className="relative hidden w-5 shrink-0 items-center justify-center self-stretch sm:flex">
              <span
                aria-hidden
                className={`absolute left-1/2 w-px -translate-x-1/2 bg-foreground/15 ${
                  i === 0 ? "bottom-0 top-1/2" : i === last ? "bottom-1/2 top-0" : "inset-y-0"
                }`}
              />
              <span className="relative z-10 h-2 w-2 rounded-full bg-foreground/40 ring-4 ring-background dark:ring-[#090909]" />
            </div>

            {/* label + meta */}
            <div className="min-w-0 sm:w-64 sm:shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground/45">{layer.n}</span>
                <span className="text-[13px] font-medium leading-tight text-foreground">{layer.label}</span>
              </div>
              <p className="mt-1 font-mono text-[10px] leading-tight text-muted-foreground/65">{layer.meta}</p>
            </div>

            {/* connecting trace */}
            <span aria-hidden className="hidden h-px flex-1 bg-foreground/10 sm:block" />

            {/* component nodes */}
            <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
              {layer.nodes.map((node) => (
                <ArchChip key={node.name} node={node} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* engineering defaults — full-width rail */}
      <div
        className={`flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-foreground/10 bg-foreground/[0.02] px-5 py-3 transition-all duration-700 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{ transitionDelay: `${ARCH_LAYERS.length * 100}ms` }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/45">
          Engineering defaults
        </span>
        {ARCH_DEFAULTS.map((item) => (
          <span key={item} className="inline-flex items-center gap-1.5 text-[12px] text-foreground/80">
            <Check className="h-3 w-3 shrink-0 text-primary" strokeWidth={3} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// OPERATING MODEL vs BOUNDARIES
// ============================================================================

const PRINCIPLE_ICONS = [Target, Route, Sparkles] as const;

function PrincipleItem({
  principle,
  index,
  last,
}: {
  principle: { number: string; title: string; description: string };
  index: number;
  last: boolean;
}) {
  const { ref, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.3 });
  const Icon = PRINCIPLE_ICONS[index] ?? Target;
  return (
    <div
      ref={ref}
      className={`relative flex gap-4 pb-8 transition-all duration-700 last:pb-0 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      {/* spine + icon node — reads as a sequential process, not a flat list */}
      <div className="relative flex w-10 shrink-0 justify-center">
        {!last && (
          <span aria-hidden className="absolute bottom-0 left-1/2 top-10 w-px -translate-x-1/2 bg-foreground/15" />
        )}
        <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-foreground/20 bg-card text-primary">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>
      <div className="pt-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground/45">{principle.number}</span>
          <h3 className="site-card-title">{principle.title}</h3>
        </div>
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
