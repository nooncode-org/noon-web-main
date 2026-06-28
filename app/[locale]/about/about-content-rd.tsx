"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Code2, Globe, ShieldCheck, Sparkles, Smartphone, Target, Receipt, Milestone, UserCheck, MoveRight } from "lucide-react";
import { useParams } from "next/navigation";
import { siteRoutes, getStartWithMaxwellHref } from "@/lib/site-config";

const LOCALES = ["en", "es", "fr", "de"];

const COMMITMENTS = [
  { icon: Target, title: "Scoped before we build", body: "Maxwell clarifies the real problem and the exact build scope before any production code is written." },
  { icon: Code2, title: "Real code, no lock-in", body: "Everything ships as real code on a standard stack — never low-code you can't move off." },
  { icon: UserCheck, title: "Senior engineers own it", body: "AI accelerates the work, but a senior engineer reviews it and owns the judgment." },
  { icon: Receipt, title: "Transparent pricing", body: "A clear quote after the scoping phase — no hourly surprises, no hidden fees." },
  { icon: Milestone, title: "Incremental delivery", body: "You get working software in phases and can track progress — not a big-bang reveal." },
  { icon: ShieldCheck, title: "Your data stays yours", body: "Ownership follows the engagement model, and your data remains yours." },
];

const WHAT_WE_BUILD = [
  {
    title: "AI & Automation",
    description: "Intelligent assistants, workflow automation, and AI-powered tooling for teams that need speed without losing operational control.",
    examples: ["AI assistants", "Automated workflows", "Smart integrations"],
    visual: "ai",
  },
  {
    title: "Web Solutions",
    description: "From customer-facing experiences to internal platforms, built as real software with production-grade architecture.",
    examples: ["Web platforms", "Dashboards", "Portals"],
    visual: "web",
  },
  {
    title: "Mobile Solutions",
    description: "Native and cross-platform mobile applications focused on clear flows and operational reliability.",
    examples: ["iOS apps", "Android apps", "Cross-platform"],
    visual: "mobile",
  },
  {
    title: "Custom Software",
    description: "Software shaped around your internal logic and non-standard workflows when generic systems stop being useful.",
    examples: ["Internal tools", "Custom integrations", "Business systems"],
    visual: "terminal",
  },
];

const PROCESS_STEPS = [
  { n: "01", label: "Brief", desc: "Describe what you need — no technical spec required.", highlight: false },
  { n: "02", label: "Scope", desc: "Maxwell defines exactly what to build and what's out of scope.", highlight: false },
  { n: "03", label: "Build", desc: "AI-accelerated development on a clean, standard stack.", highlight: false },
  { n: "04", label: "Human review", desc: "A senior engineer reads, corrects, and approves before you see it.", highlight: true },
  { n: "05", label: "Ship", desc: "Deployed, documented, and fully yours.", highlight: false },
];

const REVIEW_CHECKS = [
  { label: "Logic review", note: "Control flow and edge cases verified" },
  { label: "Security pass", note: "No exposed keys, no injection vectors" },
  { label: "Architecture sign-off", note: "Stack choices aligned with long-term maintainability" },
  { label: "Output approved", note: "Ready to ship" },
];

const YES_ITEMS = [
  "Custom software scoped before a line is written",
  "AI-accelerated development with human review",
  "Production code you own — no lock-in",
  "Incremental delivery with visible progress",
];

const NO_ITEMS = [
  "No-code shortcuts that collapse under real logic",
  "Generic marketplace for every kind of project",
  "Agencies that hide weak delivery behind polish",
  "Big-bang launches with last-minute surprises",
];

// Logotipos (wordmarks), monochrome — recolored to the theme via CSS filter.
// `s` = per-logo optical scale: each SVG has different internal padding / cap
// height, so a uniform pixel height looks uneven. Tuned so the brand text reads
// at the same optical size across all marks.
const TECH_STACK = [
  // Platform & services
  { name: "Supabase",  logo: "/figma/logotypes/wordmark-supabase.svg",  s: 1.0 },
  { name: "Vercel",    logo: "/figma/logotypes/wordmark-vercel.svg",    s: 0.95 },
  { name: "Stripe",    logo: "/figma/logotypes/wordmark-stripe.svg",    s: 1.15 },
  { name: "Resend",    logo: "/figma/logotypes/wordmark-resend.svg",    s: 0.74 },
  // AI providers
  { name: "OpenAI",    logo: "/figma/logotypes/wordmark-openai.svg",    s: 1.12 },
  { name: "Anthropic", logo: "/figma/logotypes/wordmark-anthropic.svg", s: 0.80 },
];

const FAQS = [
  { q: "How does Noon work?", a: "Start with your idea in Maxwell or Contact. Noon reviews the first direction, refines the scope with you, and delivers working software — not wireframes." },
  { q: "How long does a typical project take?", a: "Timing depends on scope and integrations. Most scoped builds land in days to weeks, not months — we pair AI generation speed with a tight review loop." },
  { q: "What does code-first mean?", a: "Every project we deliver is built in real, production-ready code. No low-code templates, no drag-and-drop builders — software you can hand off to any developer." },
  { q: "How is AI used in the process?", a: "AI accelerates our workflow at every stage: Maxwell helps scope projects, AI-assisted tooling speeds up development. A senior engineer reviews every output before it ships." },
  { q: "Who reviews the work?", a: "Every proposal is read, corrected, and approved by a senior engineer before it reaches you. AI drafts — a human decides." },
  { q: "How much does it cost?", a: "Pricing depends on scope and complexity. We provide transparent quotes after the scoping phase — no hourly surprises." },
];

/* ── Build card SVG illustrations ────────────────────────────────────────── */
function VisualAI() {
  return (
    <svg className="abt-build-svg" width="130" height="100" viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Connection lines */}
      <line x1="65" y1="50" x2="22" y2="22" stroke="currentColor" strokeWidth="1" opacity="0.35"/>
      <line x1="65" y1="50" x2="108" y2="22" stroke="currentColor" strokeWidth="1" opacity="0.35"/>
      <line x1="65" y1="50" x2="22" y2="78" stroke="currentColor" strokeWidth="1" opacity="0.35"/>
      <line x1="65" y1="50" x2="108" y2="78" stroke="currentColor" strokeWidth="1" opacity="0.35"/>
      {/* Satellite nodes */}
      <circle cx="22" cy="22" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="108" cy="22" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="22" cy="78" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="108" cy="78" r="6" stroke="currentColor" strokeWidth="1.5"/>
      {/* Center hub */}
      <circle cx="65" cy="50" r="11" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="65" cy="50" r="4" fill="currentColor" opacity="0.45"/>
      {/* Orbit ring */}
      <circle cx="65" cy="50" r="19" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 4" opacity="0.25"/>
      {/* Data dots */}
      <circle cx="43" cy="36" r="2.5" fill="currentColor" opacity="0.55"/>
      <circle cx="87" cy="36" r="2.5" fill="currentColor" opacity="0.55"/>
    </svg>
  );
}

function VisualWeb() {
  return (
    <svg className="abt-build-svg" width="150" height="106" viewBox="0 0 150 106" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Frame */}
      <rect x="5" y="6" width="140" height="94" rx="7" stroke="currentColor" strokeWidth="1.5"/>
      {/* Top bar */}
      <line x1="5" y1="26" x2="145" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      {/* Traffic lights */}
      <circle cx="19" cy="16" r="3.5" fill="currentColor" opacity="0.2"/>
      <circle cx="28" cy="16" r="3.5" fill="currentColor" opacity="0.2"/>
      <circle cx="37" cy="16" r="3.5" fill="currentColor" opacity="0.2"/>
      {/* URL bar */}
      <rect x="48" y="11" width="90" height="10" rx="4" stroke="currentColor" strokeWidth="0.75" opacity="0.28"/>
      {/* Hero area */}
      <rect x="14" y="36" width="122" height="28" rx="4" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.2"/>
      {/* Content title */}
      <rect x="14" y="36" width="64" height="7" rx="2" fill="currentColor" opacity="0.15" style={{transform: "translateY(10px)"}}/>
      {/* Below fold: text lines */}
      <rect x="14" y="74" width="72" height="4" rx="2" fill="currentColor" opacity="0.18"/>
      <rect x="14" y="82" width="118" height="3" rx="1.5" fill="currentColor" opacity="0.1"/>
      <rect x="14" y="89" width="100" height="3" rx="1.5" fill="currentColor" opacity="0.1"/>
      {/* Right column card accent */}
      <rect x="102" y="74" width="30" height="18" rx="3" stroke="currentColor" strokeWidth="0.75" opacity="0.25"/>
    </svg>
  );
}

function VisualMobile() {
  return (
    <svg className="abt-build-svg" width="72" height="116" viewBox="0 0 72 116" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Phone body */}
      <rect x="6" y="4" width="60" height="108" rx="10" stroke="currentColor" strokeWidth="1.5"/>
      {/* Top/bottom screen dividers */}
      <line x1="6" y1="20" x2="66" y2="20" stroke="currentColor" strokeWidth="0.75" opacity="0.35"/>
      <line x1="6" y1="96" x2="66" y2="96" stroke="currentColor" strokeWidth="0.75" opacity="0.35"/>
      {/* Notch */}
      <rect x="24" y="8" width="24" height="7" rx="3.5" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.25"/>
      {/* Home bar */}
      <rect x="26" y="102" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.25"/>
      {/* Content: headline */}
      <rect x="14" y="28" width="44" height="6" rx="2" fill="currentColor" opacity="0.2"/>
      {/* Subhead */}
      <rect x="14" y="38" width="32" height="4" rx="2" fill="currentColor" opacity="0.12"/>
      {/* Card */}
      <rect x="14" y="52" width="44" height="28" rx="5" stroke="currentColor" strokeWidth="1" opacity="0.25"/>
      {/* Bottom buttons */}
      <rect x="14" y="86" width="19" height="7" rx="3" fill="currentColor" opacity="0.12"/>
      <rect x="37" y="86" width="21" height="7" rx="3" fill="currentColor" opacity="0.12"/>
    </svg>
  );
}

function VisualTerminal() {
  return (
    <svg className="abt-build-svg" width="154" height="106" viewBox="0 0 154 106" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Frame */}
      <rect x="5" y="6" width="144" height="94" rx="7" stroke="currentColor" strokeWidth="1.5"/>
      {/* Top bar */}
      <line x1="5" y1="26" x2="149" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      {/* Traffic lights */}
      <circle cx="19" cy="16" r="3.5" fill="currentColor" opacity="0.2"/>
      <circle cx="28" cy="16" r="3.5" fill="currentColor" opacity="0.2"/>
      <circle cx="37" cy="16" r="3.5" fill="currentColor" opacity="0.2"/>
      {/* Prompt 1 */}
      <rect x="14" y="36" width="7" height="5" rx="1" fill="currentColor" opacity="0.4"/>
      <rect x="24" y="36" width="58" height="5" rx="1" fill="currentColor" opacity="0.14"/>
      {/* Output lines */}
      <rect x="14" y="49" width="5" height="5" rx="1" fill="currentColor" opacity="0.55"/>
      <rect x="22" y="49" width="76" height="5" rx="1" fill="currentColor" opacity="0.1"/>
      <rect x="14" y="62" width="5" height="5" rx="1" fill="currentColor" opacity="0.55"/>
      <rect x="22" y="62" width="88" height="5" rx="1" fill="currentColor" opacity="0.1"/>
      <rect x="14" y="75" width="5" height="5" rx="1" fill="currentColor" opacity="0.55"/>
      <rect x="22" y="75" width="68" height="5" rx="1" fill="currentColor" opacity="0.1"/>
      {/* Blinking cursor */}
      <rect x="14" y="88" width="8" height="9" rx="1.5" fill="currentColor" opacity="0.5">
        <animate attributeName="opacity" values="0.5;0;0.5" dur="1.2s" repeatCount="indefinite"/>
      </rect>
    </svg>
  );
}

const BUILD_VISUALS: Record<string, React.FC> = {
  ai: VisualAI,
  web: VisualWeb,
  mobile: VisualMobile,
  terminal: VisualTerminal,
};

/* ── FAQ accordion ───────────────────────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="abt-faq-item">
      <button className="abt-faq-q" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {q}
        <ChevronDown size={16} className={`abt-faq-chevron${open ? " open" : ""}`} />
      </button>
      {open && <div className="abt-faq-a">{a}</div>}
    </div>
  );
}

/* ── Main content ────────────────────────────────────────────────────────── */
export function AboutContentRd() {
  const params = useParams();
  const paramLocale = typeof params?.locale === "string" ? params.locale : null;
  const locale = paramLocale && LOCALES.includes(paramLocale) ? paramLocale : "en";
  const lp = (href: string) => `/${locale}${href}`;

  /* Scroll-trigger for review checklist */
  const reviewRef = useRef<HTMLDivElement>(null);
  const [reviewInView, setReviewInView] = useState(false);
  useEffect(() => {
    const el = reviewRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setReviewInView(true); obs.disconnect(); } },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <section className="abt-hero">
        <div className="abt-wrap">
          <div className="abt-hero-inner">
            <p className="abt-kicker" style={{ marginBottom: 20 }}>Company</p>
            <h1 className="abt-display">
              A technology development company{" "}
              <span style={{ color: "var(--text-secondary)" }}>built around real delivery.</span>
            </h1>
            <p className="abt-lead abt-hero-lead">
              You have a business problem that needs software. We define exactly what to build, build it, and deliver it in code you own.
            </p>
            <div className="abt-hero-actions">
              <Link href={lp(getStartWithMaxwellHref())} className="abt-btn abt-btn-primary">
                Start with Maxwell <ArrowRight size={15} />
              </Link>
              <Link href={lp(siteRoutes.services)} className="abt-btn abt-btn-secondary">
                View services
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── why noon ─────────────────────────────────────────────────────── */}
      <div className="abt-divider" />
      <section className="abt-section">
        <div className="abt-wrap">
          <div className="abt-panel">
            <div className="abt-panel-anchor">
              <p className="abt-kicker">Why Noon</p>
              <h2 className="abt-h2">
                What working with us{" "}
                <span style={{ color: "var(--text-secondary)" }}>looks like.</span>
              </h2>
            </div>
            <div className="abt-why-grid">
              {COMMITMENTS.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.title} className="abt-why-card">
                    <div className="abt-why-icon">
                      <Icon size={16} strokeWidth={1.75} />
                    </div>
                    <p className="abt-why-title">{c.title}</p>
                    <p className="abt-why-body">{c.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── what we build ────────────────────────────────────────────────── */}
      <div className="abt-divider" />
      <section className="abt-section">
        <div className="abt-wrap">
          <div className="abt-panel">
            <div className="abt-panel-anchor">
              <p className="abt-kicker">Capabilities</p>
              <h2 className="abt-h2">What we build.</h2>
              <p className="abt-lead">Software shaped around your problem, not the other way around.</p>
            </div>
            <div className="abt-build-grid">
              {WHAT_WE_BUILD.map((item) => {
                const Visual = BUILD_VISUALS[item.visual];
                return (
                  <div key={item.title} className="abt-build-card">
                    <div className="abt-build-visual">
                      <Visual />
                    </div>
                    <div className="abt-build-body">
                      <p className="abt-build-title">{item.title}</p>
                      <p className="abt-build-desc">{item.description}</p>
                      <div className="abt-build-footer">
                        <div className="abt-build-tags">
                          {item.examples.map((ex) => (
                            <span key={ex} className="abt-build-tag">{ex}</span>
                          ))}
                        </div>
                        <Link href={lp(siteRoutes.services)} className="abt-circle-btn" aria-label={`Learn about ${item.title}`}>
                          <MoveRight size={14} />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── delivery process ─────────────────────────────────────────────── */}
      <div className="abt-divider" />
      <section className="abt-section">
        <div className="abt-wrap">
          <div className="abt-panel">
            <div className="abt-panel-anchor">
              <p className="abt-kicker">Process</p>
              <h2 className="abt-h2">
                From idea to launch.{" "}
                <span style={{ color: "var(--text-secondary)" }}>Reviewed the whole way.</span>
              </h2>
            </div>
            <div className="abt-process-steps">
              {PROCESS_STEPS.map((step) => (
                <div key={step.n} className={`abt-process-step${step.highlight ? " highlight" : ""}`}>
                  <p className="abt-process-num">{step.n}</p>
                  <div>
                    <p className="abt-process-label">{step.label}</p>
                    <p className="abt-process-desc">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── human review ─────────────────────────────────────────────────── */}
      <div className="abt-divider" />
      <section className="abt-section" style={{ paddingTop: 0 }}>
        <div className="abt-wrap">
          <div ref={reviewRef} className={`abt-review${reviewInView ? " in-view" : ""}`}>
            <div className="abt-review-inner">
              <div>
                <p className="abt-kicker" style={{ marginBottom: 16 }}>Human review gate</p>
                <h2 className="abt-h2">
                  AI drafts.{" "}
                  <span style={{ color: "var(--text-secondary)" }}>A person decides.</span>
                </h2>
                <p className="abt-lead" style={{ marginTop: 16 }}>
                  Every output — scope, code, architecture decision — is read, corrected, and approved by a senior engineer before it reaches you. That&apos;s the gate that makes the difference.
                </p>
              </div>
              <div className="abt-review-artifact">
                <div className="abt-review-artifact-head">
                  <span className="abt-review-artifact-dot" />
                  <span className="abt-review-artifact-label">Build review · Senior engineer</span>
                </div>
                <div className="abt-review-artifact-body">
                  {REVIEW_CHECKS.map((item) => (
                    <div key={item.label} className="abt-review-artifact-row">
                      <Check size={12} className="check" strokeWidth={2.5} />
                      <div>
                        <strong>{item.label}</strong>
                        <span> — {item.note}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── differentiation ──────────────────────────────────────────────── */}
      <div className="abt-divider" />
      <section className="abt-section">
        <div className="abt-wrap">
          <div className="abt-panel">
            <div className="abt-panel-anchor">
              <p className="abt-kicker">The difference</p>
              <h2 className="abt-h2">
                What Noon is —{" "}
                <span style={{ color: "var(--text-secondary)" }}>and what it&apos;s not.</span>
              </h2>
            </div>
            <div className="abt-diff-inner">
              <div className="abt-diff-col">
                <p className="abt-kicker abt-diff-col-label">Noon</p>
                <ul className="abt-diff-list">
                  {YES_ITEMS.map((item) => (
                    <li key={item} className="abt-diff-item yes">
                      <span className="marker">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="abt-diff-col">
                <p className="abt-kicker abt-diff-col-label">Not Noon</p>
                <ul className="abt-diff-list">
                  {NO_ITEMS.map((item) => (
                    <li key={item} className="abt-diff-item no">
                      <span className="marker">−</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── tech stack ───────────────────────────────────────────────────── */}
      <div className="abt-divider" />
      <section className="abt-section">
        <div className="abt-wrap">
          <div className="abt-sechead" style={{ marginBottom: 24 }}>
            <p className="abt-kicker">Stack</p>
            <h2 className="abt-h2" style={{ marginTop: 12 }}>The stack behind every build.</h2>
            <p className="abt-lead" style={{ marginTop: 12 }}>
              Technology choices follow the product, not the other way around. Every project is delivered in code you own and can hand off to any developer.
            </p>
          </div>
          <div className="abt-stack-row">
            {TECH_STACK.map((item) => (
              <span key={item.name} className="abt-stack-logo" title={item.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.logo} alt={item.name} style={{ "--s": item.s } as CSSProperties} />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── statement ────────────────────────────────────────────────────── */}
      <div className="abt-divider" />
      <section className="abt-statement">
        <div className="abt-wrap">
          <div className="abt-statement-box">
            <span className="abt-xhair abt-xhair-tl" aria-hidden />
            <span className="abt-xhair abt-xhair-tr" aria-hidden />
            <span className="abt-xhair abt-xhair-bl" aria-hidden />
            <span className="abt-xhair abt-xhair-br" aria-hidden />
            <p className="abt-statement-text">
              <span style={{ color: "var(--text-secondary)" }}>We don&apos;t build software.</span>{" "}
              We solve business problems with code.
            </p>
          </div>
        </div>
      </section>

      {/* ── faq ──────────────────────────────────────────────────────────── */}
      <div className="abt-divider" />
      <section className="abt-section">
        <div className="abt-wrap">
          <div className="abt-sechead" style={{ marginBottom: 32 }}>
            <p className="abt-kicker">FAQ</p>
            <h2 className="abt-h2" style={{ marginTop: 12 }}>Common questions.</h2>
          </div>
          <div className="abt-faq">
            {FAQS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── cta ──────────────────────────────────────────────────────────── */}
      <section className="abt-section" style={{ paddingTop: 0 }}>
        <div className="abt-wrap">
          <div className="abt-cta-row">
            <Link href={lp(getStartWithMaxwellHref())} className="abt-cta-mega">
              <span className="abt-cta-mega-text">Start with Maxwell</span>
              <span className="abt-cta-mega-circle">
                <MoveRight size={20} />
              </span>
            </Link>
            <div className="abt-cta-side">
              <Link href={lp(siteRoutes.contact)} className="abt-cta-side-btn">
                Talk to us
                <span className="abt-cta-side-circle"><MoveRight size={13} /></span>
              </Link>
              <Link href={lp(siteRoutes.services)} className="abt-cta-side-btn">
                View services
                <span className="abt-cta-side-circle"><MoveRight size={13} /></span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
