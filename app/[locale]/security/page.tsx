import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, KeyRound, Server, ScanLine } from "lucide-react";
import { SitePageFrame } from "@/app/_components/site/site-page-frame";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { getContactHref } from "@/lib/site-config";
import { MaskLogo } from "@/components/ui/mask-logo";
import { FaqSection, type Faq } from "@/components/landing/faq-section";

export const metadata: Metadata = {
  title: "Security & ownership | Noon",
  description:
    "How Noon keeps your build safe and yours: every line human-reviewed, full code & IP ownership, and certified infrastructure.",
};

// Conservative, verifiable claims only: the human-review wedge (brand-stated),
// code/IP ownership (brand-stated), and infra certifications (vendor facts).
// Specifics (Noon's own SOC 2, DPAs, data residency) route to a conversation —
// no fabricated certifications.
const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Every line is human-reviewed",
    body: "AI accelerates the build, but a senior engineer reads and reviews every change before it ships — including for security. Nothing reaches production unreviewed.",
  },
  {
    icon: KeyRound,
    title: "You own everything",
    body: "You get the code, the repository, and full ownership of the IP. No lock-in, no black box — what we build is yours to run, change, and take anywhere.",
  },
  {
    icon: Server,
    title: "Built on certified infrastructure",
    body: "Your build runs on Vercel, Stripe, and Supabase — infrastructure already trusted by enterprises and independently certified to SOC 2, PCI-DSS, and ISO standards.",
  },
  {
    icon: ScanLine,
    title: "Security reviewed, not bolted on",
    body: "Dependencies, access, and data handling are considered as part of the human review — not an afterthought once the code is already written.",
  },
];

// Security-specific FAQ — every answer mirrors a claim already on this page
// (the pillars / infra notes) or the site's published confidentiality practice.
// Specifics we can't claim yet (Noon's own SOC 2, DPAs) route to a conversation.
const SECURITY_FAQS: Faq[] = [
  {
    question: "Who can see my code and my data?",
    answer:
      "The senior engineers reviewing your build — that's the point of human review — and nobody else. Client work is treated as confidential, your data remains yours, and anything we showcase publicly is anonymized, as on our Work page.",
  },
  {
    question: "Do I own the code and the IP?",
    answer:
      "Yes. You get the code, the repository, and full ownership of the IP for what has been delivered. No lock-in, no black box — what we build is yours to run, change, and take anywhere.",
  },
  {
    question: "Is Noon SOC 2 certified?",
    answer:
      "Your build runs on infrastructure that is — Vercel, Stripe, and Supabase are independently certified to SOC 2, PCI-DSS, and ISO standards. For Noon's own controls, a DPA, or your procurement team's security review, talk to us and we'll walk through exactly how we handle it.",
  },
  {
    question: "How is security handled during the build?",
    answer:
      "As part of the same human review that gates every change: dependencies, access, and data handling are considered while the code is written — not bolted on after. Nothing reaches production unreviewed.",
  },
];

// Sub-processors / data-handling table — DRAFT FOR OWNER REVIEW. Grounded in
// the providers this codebase actually uses (auth, payments, db, email, AI)
// and the vendors already named on this page. Card data never touches Noon's
// servers (Stripe Checkout). Naming OpenAI/v0 here follows
// disclosure-over-abstraction: a security page is where vendor accuracy
// matters more than marketing abstraction — owner to confirm.
const SUBPROCESSORS: { provider: string; purpose: string; data: string }[] = [
  {
    provider: "Vercel",
    purpose: "Hosting & delivery of the site and client builds",
    data: "Request data, server logs",
  },
  {
    provider: "Supabase",
    purpose: "Application database (encrypted Postgres)",
    data: "Project and workspace data",
  },
  {
    provider: "Stripe",
    purpose: "Payments",
    data: "Billing details — card data is handled by Stripe and never touches Noon's servers",
  },
  {
    provider: "Resend",
    purpose: "Transactional email",
    data: "Email address, message content",
  },
  {
    provider: "OpenAI · Vercel v0",
    purpose: "AI assistance inside Maxwell (scoping, prototype generation)",
    data: "The briefs and conversation content you provide",
  },
  {
    provider: "Google",
    purpose: "Sign-in (OAuth)",
    data: "Account email and basic profile",
  },
];

const INFRA: { src: string; alt: string; note: string }[] = [
  { src: "/figma/logos/logo-vercel.svg", alt: "Vercel", note: "SOC 2 Type 2" },
  { src: "/figma/logos/logo-stripe.svg", alt: "Stripe", note: "PCI-DSS Level 1" },
  { src: "/figma/logos/logo-supabase.svg", alt: "Supabase", note: "SOC 2 · encrypted Postgres" },
];

type SecurityPageProps = { params: Promise<{ locale: string }> };

export default async function SecurityPage({ params }: SecurityPageProps) {
  const { locale } = await params;
  const lp = (href: string) => `/${locale}${href}`;
  const viewer = await getAuthenticatedViewer();
  const contactHref = lp(getContactHref({ inquiry: "general", source: "security" }));

  return (
    <SitePageFrame viewer={viewer}>
      <div className="site-shell py-12 lg:py-16">
        {/* header */}
        <div className="mx-auto mb-12 max-w-3xl text-center lg:mb-16">
          <p className="site-meta-label mb-4 font-mono text-muted-foreground">Security &amp; ownership</p>
          <h1 className="site-hero-title mb-4">Your code, reviewed by people — and yours to keep.</h1>
          <p className="site-hero-copy mx-auto max-w-xl text-muted-foreground">
            AI makes the build fast. Human review and real ownership make it safe to run your
            business on.
          </p>
        </div>

        {/* pillars — hairline grid */}
        <div className="mx-auto max-w-4xl overflow-hidden rounded-[12px] border border-foreground/12">
          <div className="grid gap-px bg-foreground/10 sm:grid-cols-2">
            {PILLARS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="flex flex-col bg-background p-6 lg:p-7">
                  <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-[8px] border border-primary/30 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <h2 className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
                    {p.title}
                  </h2>
                  <p className="mt-2 text-sm leading-snug text-muted-foreground">{p.body}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* certified infra strip */}
        <div className="mx-auto mt-6 flex max-w-4xl flex-col gap-3 rounded-[12px] border border-foreground/10 bg-card/30 px-6 py-5 sm:flex-row sm:items-center sm:gap-8">
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
            Certified infra
          </span>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
            {INFRA.map((l) => (
              <span key={l.alt} className="inline-flex items-center gap-2">
                <MaskLogo src={l.src} alt={l.alt} className="h-4 w-4 opacity-60" />
                <span className="text-[12px] text-foreground/80">{l.alt}</span>
                <span className="font-mono text-[10px] text-muted-foreground/55">{l.note}</span>
              </span>
            ))}
          </div>
        </div>

        {/* sub-processors / where your data lives */}
        <div className="mx-auto mt-12 max-w-4xl lg:mt-16">
          <div className="mb-5 max-w-2xl">
            <h2 className="site-section-title mb-2">Where your data lives.</h2>
            <p className="site-section-copy text-muted-foreground">
              The services a Noon build runs on — the same stack named across this page. Need the
              full DPA picture? That&apos;s the conversation below.
            </p>
          </div>
          <div className="overflow-hidden rounded-[12px] border border-foreground/10">
            <div className="hidden grid-cols-[150px_1.1fr_1.3fr] gap-px bg-foreground/10 text-sm sm:grid">
              <div className="bg-background p-3.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">
                Provider
              </div>
              <div className="bg-background p-3.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">
                Purpose
              </div>
              <div className="bg-background p-3.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">
                Data involved
              </div>
              {SUBPROCESSORS.map((s) => (
                <div key={s.provider} className="contents">
                  <div className="bg-background p-3.5 font-medium text-foreground">{s.provider}</div>
                  <div className="bg-background p-3.5 text-muted-foreground">{s.purpose}</div>
                  <div className="bg-background p-3.5 text-muted-foreground">{s.data}</div>
                </div>
              ))}
            </div>
            {/* mobile: stacked */}
            <div className="divide-y divide-foreground/10 sm:hidden">
              {SUBPROCESSORS.map((s) => (
                <div key={s.provider} className="bg-background p-4">
                  <div className="text-sm font-medium text-foreground">{s.provider}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{s.purpose}</div>
                  <div className="mt-1 text-[13px] text-muted-foreground/80">{s.data}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Security-specific FAQ (per-page depth — see SECURITY_FAQS) */}
      <FaqSection items={SECURITY_FAQS} />

      <div className="site-shell pb-12 lg:pb-16">
        {/* consultative CTA — specifics route to a conversation, no fabricated certs */}
        <div className="mx-auto max-w-3xl rounded-[12px] border border-foreground/10 bg-card/40 p-8 text-center">
          <h2 className="site-section-title mb-3">Specific compliance requirements?</h2>
          <p className="site-section-copy mx-auto mb-5 max-w-xl text-muted-foreground">
            SOC 2, a DPA, data residency, or a security review for your procurement team — tell us
            what you need and we&apos;ll walk you through exactly how we handle it.
          </p>
          <Link
            href={contactHref}
            className="site-primary-action inline-flex h-11 items-center rounded-full px-6 text-sm font-medium"
          >
            Talk to us about security
          </Link>
        </div>
      </div>
    </SitePageFrame>
  );
}
