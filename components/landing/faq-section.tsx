"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useRevealOnView } from "@/hooks/use-reveal-on-view";
import { siteRoutes } from "@/lib/site-config";
import { siteTones } from "@/lib/site-tones";

export type Faq = { question: string; answer: string };

// Default set (About). Pages can pass their own `items` — the audit asks for
// per-page FAQ depth; contact renders its own inline FAQ list (not this component).
const DEFAULT_FAQS: Faq[] = [
  {
    question: "How does Noon work?",
    answer: "Start with your idea in Maxwell or Contact. Noon reviews the first direction, refines it when needed, and then moves into proposal, payment activation, and phased delivery when the scope calls for it.",
  },
  {
    question: "How long does a typical project take?",
    answer: "Timing depends on scope, integrations, and whether the work needs to move in phases. Maxwell helps clarify the first direction, and Noon then defines delivery timing in the formal proposal.",
  },
  {
    question: "What does code-first mean?",
    answer: "Every project we deliver is built in real, production-ready code. No low-code templates, no drag-and-drop builders. Ownership depends on the engagement model and what has been paid for and delivered, while client data remains the client's.",
  },
  {
    question: "How is AI used in the process?",
    answer: "AI accelerates our workflow at every stage: Maxwell helps scope projects, AI-assisted coding speeds up development, and automated testing ensures quality. The result is faster delivery without compromising on code quality.",
  },
  {
    question: "Who reviews the work?",
    answer: "Every proposal is read, corrected, and approved by a PM before it reaches you, and every code change is signed off by a senior engineer before it ships. AI accelerates the work — a person owns the judgment.",
  },
  {
    question: "What types of projects do you build?",
    answer: "We specialize in custom software: client portals, internal dashboards, AI-powered tools, marketplaces, mobile apps, and workflow automation. We focus on software that solves real operational problems.",
  },
  {
    question: "How much does it cost?",
    answer: "Pricing depends on scope and complexity. We provide transparent quotes after the scoping phase with Maxwell. No hidden fees, no hourly billing surprises. You know the full cost before we start building.",
  },
];

function FAQItem({
  faq,
  index,
  isOpen,
  onToggle,
}: {
  faq: Faq;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { ref: itemRef, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.15 });

  return (
    <div
      ref={itemRef}
      className={`border transition-all duration-700 ${
        isOpen
          ? "border-foreground/12 bg-background/70 shadow-sm"
          : "border-foreground/6 bg-background/30 hover:border-foreground/10 hover:bg-background/50"
      } ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      style={{ transitionDelay: `${index * 60}ms` }}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={isOpen}
      >
        <span className={`text-sm font-medium transition-colors duration-200 ${isOpen ? "text-foreground" : "text-foreground/80"}`}>
          {faq.question}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {/* grid-rows collapse (not max-h): a fixed max-height clips answers that
         outgrow it — this animates to the content's real height, any length. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <p className="site-card-copy px-5 pb-4 text-muted-foreground">{faq.answer}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqSection({ items = DEFAULT_FAQS }: { items?: Faq[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { ref: sectionRef, isVisible } = useRevealOnView<HTMLDivElement>({ threshold: 0.1 });
  // Locale-prefixed Maxwell link — the bare route relied on a 307 redirect hop
  // and dropped the active locale (audit 2026-06-01, faq-section.tsx:116).
  const locale = useLocale();

  // FAQPage structured data, generated from the same items the section renders
  // (so search engines read exactly what users see). Client components are
  // SSR'd, so this lands in the initial HTML.
  const faqJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  });

  return (
    <section id="faq" ref={sectionRef} className="relative py-20 lg:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Figma /about + /contact FAQ — one large bordered card with a
           vertical divider between the left aside (Pill + heading + Ask Maxwell
           CTA) and the right list of expandable questions. */}
        <div className="relative overflow-hidden border border-foreground/10 bg-card/40">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,_22rem)_1fr] lg:divide-x lg:divide-foreground/10">
            {/* Left aside */}
            <div className="p-6 lg:p-8">
              <span className="mb-4 liquid-glass-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: siteTones.brand.accent }} />
                FAQ
              </span>
              <h2
                className={`site-section-title mb-4 transition-all duration-700 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                Common questions
              </h2>
              <p
                className={`site-section-copy mb-8 text-muted-foreground transition-all duration-700 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: "100ms" }}
              >
                Everything you need to know about working with Noon.
                Can&apos;t find what you&apos;re looking for? Start a conversation with Maxwell.
              </p>
              <Link
                href={`/${locale}${siteRoutes.maxwellStudio}`}
                className={`inline-flex items-center gap-2.5 rounded-full border border-foreground/10 bg-secondary/50 px-4 py-2 text-sm font-medium transition-all duration-300 hover:border-foreground/20 hover:bg-secondary ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: "200ms" }}
              >
                Ask Maxwell
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: siteTones.gateway.accent }}
                />
              </Link>
            </div>

            {/* Right list */}
            <div className="flex flex-col gap-2 p-6 lg:p-8">
              {items.map((faq, index) => (
                <FAQItem
                  key={faq.question}
                  faq={faq}
                  index={index}
                  isOpen={openIndex === index}
                  onToggle={() => setOpenIndex(openIndex === index ? null : index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
