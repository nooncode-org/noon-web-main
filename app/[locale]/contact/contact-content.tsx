"use client";

import {
  ArrowRight,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SiteCtaBlock } from "@/app/_components/site/site-cta-block";
import { ContactIntakeForm } from "@/app/_components/site/contact-intake-form";
import { FaqSection } from "@/components/landing/faq-section";
import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import { contactInbox, normalizeContactInquiry } from "@/lib/contact";
import { getStartWithMaxwellHref, siteRoutes } from "@/lib/site-config";
import { ResponseTimeline } from "@/components/sections/premium";

const LOCALES = ["en", "es", "fr", "de"];

const OTHER_CHANNELS = [
  { label: "LinkedIn", href: "https://www.linkedin.com" },
  { label: "GitHub", href: "https://github.com" },
  { label: "TikTok", href: "https://www.tiktok.com" },
];

function ContactProcessPanel({ responseTime }: { responseTime: string }) {
  const steps = [
    {
      label: "Route",
      description: "Pick the closest request type so it reaches the right review path.",
    },
    {
      label: "Review",
      description: responseTime,
    },
    {
      label: "Next step",
      description: "Noon replies with clarification, proposal direction, or direct guidance.",
    },
  ];

  return (
    <div>
      {/* Figma: "HOW IT MOVES" stepper card — all 3 steps share the same
         outlined neutral chip (sandbox ContactAside.tsx has no brand fill on
         step 1). Steps are separated by top borders only. */}
      <div className="border border-foreground/10 bg-card/40 p-5 lg:p-6">
        <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          How it moves
        </p>
        <div className="mt-5">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className={`grid grid-cols-[1.75rem_1fr] gap-3 ${
                index > 0 ? "mt-4 border-t border-foreground/10 pt-4" : ""
              }`}
            >
              <div className="flex h-7 w-7 items-center justify-center border border-foreground/20 bg-transparent text-[12px] font-mono text-foreground">
                {index + 1}
              </div>
              <div>
                <p className="text-sm font-medium leading-tight text-foreground">{step.label}</p>
                <p className="site-card-copy mt-1.5 text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
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

export function ContactPageSkeleton() {
  return (
    <>
      <section className="site-hero-section">
        <div className="site-shell">
          <div className="max-w-3xl">
            <div className="mb-6 h-6 w-32 animate-pulse rounded bg-secondary" />
            <div className="mb-6 h-12 w-64 animate-pulse rounded bg-secondary" />
            <div className="h-6 w-96 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      </section>
    </>
  );
}

export function ContactPageContent() {
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
    <>
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
                    className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    {t("continueWithMaxwell")}
                    <ArrowRight className="h-4 w-4" />
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

      {/* Pipeline stats band (Figma /contact frame) — at web-main scale.
         Three left-aligned columns split by vertical dividers, per Figma. */}
      <section className="site-section">
        <div className="site-shell">
          <div className="grid border border-foreground/10 bg-card/60 sm:grid-cols-3 sm:divide-x sm:divide-foreground/10">
            {[
              {
                eyebrow: "Pipeline speed",
                stat: "3x Faster",
                copy: "Maxwell's orchestration (GPT-4 + V0 + Opus) accelerates the generation of functional bases.",
              },
              {
                eyebrow: "Development",
                stat: "0% No-Code.",
                copy: "All software is real code, eliminating dependencies on limited and fragile platforms.",
              },
              {
                eyebrow: "Validation",
                stat: "100% Human QA.",
                copy: "Each line of AI-generated code is validated and refined by senior engineers before deployment.",
              },
            ].map((s) => (
              <div key={s.eyebrow} className="p-6 lg:p-7">
                <p className="mb-3 text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                  {s.eyebrow}
                </p>
                <p className="site-section-title mb-2">{s.stat}</p>
                <p className="site-card-copy text-muted-foreground">{s.copy}</p>
              </div>
            ))}
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
            description: "We confirm receipt of your inquiry within 2 business hours during working days. You'll know we received your message.",
          },
          {
            time: "24h",
            title: "Initial Review",
            description: "Our team reviews your request and routes it to the appropriate specialist. Complex requests may require additional context.",
          },
          {
            time: "48h",
            title: "Detailed Response",
            description: "You receive a substantive reply with next steps, clarifying questions, or a preliminary assessment of your project.",
          },
          {
            time: "1 week",
            title: "Discovery Call",
            description: "For qualified projects, we schedule a discovery call to discuss requirements, constraints, and delivery expectations in depth.",
          },
        ]}
      />

      <FaqSection />

      <SiteCtaBlock
        title="Start building your idea with Maxwell here"
        blockHref={lp(siteRoutes.home)}
        className="!pt-8 !pb-10 lg:!pt-10 lg:!pb-12"
      />
      </div>
    </>
  );
}
