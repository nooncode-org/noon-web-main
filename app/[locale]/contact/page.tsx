"use client";

import { Suspense } from "react";
import {
  ArrowRight,
  Code2,
  Mail,
  Reply,
  Route,
  ScanSearch,
  Sparkles,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SitePageFrame } from "@/app/_components/site/site-page-frame";
import { SiteCtaBlock } from "@/app/_components/site/site-cta-block";
import { ContactIntakeForm } from "@/app/_components/site/contact-intake-form";
import { FaqSection } from "@/components/landing/faq-section";
import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import { contactInbox, normalizeContactInquiry } from "@/lib/contact";
import { getStartWithMaxwellHref, siteRoutes } from "@/lib/site-config";
import { siteTones } from "@/lib/site-tones";
import { ResponseTimeline } from "@/components/sections/premium";

const LOCALES = ["en", "es", "fr", "de"];

// Real Noon social channels (mirrors footerSocialLinks in lib/site-config) —
// TikTok / Facebook / Instagram only, per brand (no LinkedIn/GitHub/X).
const OTHER_CHANNELS = [
  { label: "TikTok", href: "https://www.tiktok.com/@nooncode.dev" },
  { label: "Facebook", href: "https://www.facebook.com/people/Noon-Development-Agency/61571938881520/" },
  { label: "Instagram", href: "https://www.instagram.com/nooncode.dev" },
];

function ContactProcessPanel({ responseTime }: { responseTime: string }) {
  const steps = [
    {
      icon: Route,
      label: "Route",
      description: "Pick the closest request type so it reaches the right review path.",
    },
    {
      icon: ScanSearch,
      label: "Review",
      description: responseTime,
    },
    {
      icon: Reply,
      label: "Next step",
      description: "Noon replies with clarification, proposal direction, or direct guidance.",
    },
  ];

  return (
    <div>
      {/* "HOW IT MOVES" — a compact visual process flow: icon nodes on a spine,
         so the 3 steps read as a sequence at a glance instead of a numbered list. */}
      <div className="border border-foreground/10 bg-card/40 p-5 lg:p-6">
        <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          How it moves
        </p>
        <div className="mt-5">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const last = index === steps.length - 1;
            return (
              <div key={step.label} className="relative flex gap-3 pb-5 last:pb-0">
                <div className="relative flex w-8 shrink-0 justify-center">
                  {!last && (
                    <span aria-hidden className="absolute bottom-0 left-1/2 top-8 w-px -translate-x-1/2 bg-foreground/15" />
                  )}
                  <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-[8px] border border-foreground/15 bg-card text-primary">
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                </div>
                <div className="pt-0.5">
                  <p className="text-sm font-medium leading-tight text-foreground">{step.label}</p>
                  <p className="site-card-copy mt-1 text-muted-foreground">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Figma: "OTHER CHANNELS" — mono eyebrow + inline links. */}
      <div className="mt-6 border-t border-foreground/10 pt-6">
        <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          Other channels
        </p>
        <div className="mt-3.5 flex items-center gap-6">
          {OTHER_CHANNELS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground"
            >
              {c.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<ContactPageSkeleton />}>
      <ContactPageContent />
    </Suspense>
  );
}

function ContactPageSkeleton() {
  return (
    <SitePageFrame>
      <section className="site-hero-section">
        <div className="site-shell">
          <div className="max-w-3xl">
            <div className="mb-6 h-6 w-32 animate-pulse rounded bg-secondary" />
            <div className="mb-6 h-12 w-64 animate-pulse rounded bg-secondary" />
            <div className="h-6 w-96 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      </section>
    </SitePageFrame>
  );
}

function ContactPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const inquiry = searchParams.get("inquiry") || undefined;
  const draft = searchParams.get("draft") || "";
  const source = searchParams.get("source") || undefined;

  const t = useTranslations("contact");

  const normalizedInquiry = normalizeContactInquiry(inquiry);
  const trimmedDraft = draft.trim();
  const canReturnToMaxwell = trimmedDraft.length > 0 || source === "maxwell";
  const maxwellReturnHref = getStartWithMaxwellHref(trimmedDraft || undefined);
  const paramLocale = typeof params?.locale === "string" ? params.locale : null;
  const locale = (paramLocale && LOCALES.includes(paramLocale) ? paramLocale : "en");
  const lp = (href: string) => `/${locale}${href}`;

  const { ref: headerRef, isVisible: headerVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.1 });

  return (
    <SitePageFrame>
      {/* figma-canon: Instrument Sans (the Figma typeface) on headings. */}
      <div className="figma-canon">
      <section ref={headerRef} className="site-hero-section pb-4 lg:pb-5">
        <div className="site-shell">
          <div className="grid w-full items-start gap-8 lg:grid-cols-[minmax(0,420px)_820px] lg:justify-between lg:gap-10">
            <div className="space-y-5">
              <h1
                className={`site-hero-title transition-all duration-700 ${
                  headerVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: "100ms" }}
              >
                {t("hero.headline")}
              </h1>
              <p
                className={`site-hero-copy text-muted-foreground transition-all duration-700 ${
                  headerVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: "200ms" }}
              >
                {t("hero.description")}
              </p>
              <p
                className={`text-sm text-muted-foreground transition-all duration-700 ${
                  headerVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: "260ms" }}
              >
                {t("hero.responseTime")}
              </p>
              <div
                className={`flex flex-wrap gap-3 transition-all duration-700 ${
                  headerVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: "320ms" }}
              >
                <a
                  href={`mailto:${contactInbox}`}
                  className="site-primary-action inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium"
                >
                  <Mail className="h-4 w-4" />
                  {contactInbox}
                </a>
                {canReturnToMaxwell ? (
                  <Link
                    href={maxwellReturnHref}
                    className="group inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    {t("continueWithMaxwell")}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
                  </Link>
                ) : null}
              </div>
              <div
                className={`hidden transition-all duration-700 lg:block ${
                  headerVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: "380ms" }}
              >
                <ContactProcessPanel responseTime={t("hero.responseTime")} />
              </div>
            </div>

            <div id="contact-intake" className="min-w-0 w-full lg:w-[820px] lg:justify-self-end">
              <ContactIntakeForm
                initialInquiry={normalizedInquiry}
                initialDraft={trimmedDraft}
                initialSource={source}
                layout="stacked"
                showGuidance={false}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities band — three honest, qualitative columns (no fabricated
         metrics, no 3rd-party model names). Icon + category + a concrete claim
         + supporting copy, split by vertical dividers (Vercel 3-up style). */}
      <section className="site-section">
        <div className="site-shell">
          <div className="grid border border-foreground/10 bg-card/60 sm:grid-cols-3 sm:divide-x sm:divide-foreground/10">
            {[
              {
                icon: Sparkles,
                eyebrow: "Pipeline speed",
                headline: "Maxwell-accelerated",
                copy: "Maxwell turns your need into a working, functional base — so engineers start from real software, not a blank file.",
              },
              {
                icon: Code2,
                eyebrow: "Development",
                headline: "Real code, not no-code",
                copy: "All software ships as real code — no lock-in to limited, fragile platforms.",
              },
              {
                icon: UserCheck,
                eyebrow: "Validation",
                headline: "Human-reviewed",
                copy: "AI-generated code is reviewed and refined by senior engineers before it ships.",
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.eyebrow} className="p-6 lg:p-7">
                  <div className="mb-4 flex items-center gap-2.5">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-[8px] text-primary"
                      style={{ backgroundColor: "rgba(18,0,197,0.10)" }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                      {s.eyebrow}
                    </p>
                  </div>
                  <p className="site-card-title mb-2">{s.headline}</p>
                  <p className="site-card-copy text-muted-foreground">{s.copy}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Premium: Response Commitment timeline */}
      <ResponseTimeline
        title="Our Response Commitment"
        subtitle="Transparent communication at every step"
        steps={[
          {
            time: "< 2h",
            title: "Acknowledgment",
            description: "We confirm we've got your inquiry within 2 business hours — you're never left wondering.",
          },
          {
            time: "24h",
            title: "Initial Review",
            description: "Your request reaches the right specialist, with any missing context flagged early.",
          },
          {
            time: "48h",
            title: "Detailed Response",
            description: "A substantive reply: next steps, clarifying questions, or a first read on your project.",
          },
          {
            time: "1 week",
            title: "Discovery Call",
            description: "For a strong fit, we set up a call to go deep on requirements, constraints, and delivery.",
          },
        ]}
      />

      <FaqSection />

      <SiteCtaBlock
        title="Start building your idea with Maxwell here"
        blockHref={lp(siteRoutes.maxwellStudio)}
        className="!pt-8 !pb-10 lg:!pt-10 lg:!pb-12"
      />
      </div>
    </SitePageFrame>
  );
}
