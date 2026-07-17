import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ArrowRight, Mail } from "lucide-react";
import { ContactIntakeForm } from "@/app/_components/site/contact-intake-form";
import { SiteNav } from "@/app/_components/site/site-nav";
import { SiteFooterRd } from "@/app/_components/site/site-footer-rd";
import { ContactScroll } from "./contact-scroll";
import { contactInbox, normalizeContactInquiry } from "@/lib/contact";
import "./contact-rd.css";
import "@/app/_components/site/site-footer-rd.css";

export const metadata: Metadata = {
  title: "Contact | Noon",
  description:
    "Tell us what you're working on — a person reads every request. Project work, engineering support, a question, or a partnership. We usually respond within 1-2 business days.",
  alternates: { canonical: "/en/contact" },
};

const TIMELINE = [
  { time: "1 business day", title: "Received", copy: "Your message reaches a real person — you'll know it's in hand, whatever the topic." },
  { time: "2–3 days", title: "A real reply", copy: "Not an auto-response — a genuine answer, or the right questions to move things forward." },
  { time: "From there", title: "The right next step", copy: "A call, an intro, or a straight answer — whatever fits what you came for." },
];


const FAQS = [
  { q: "Should I start with Maxwell or this form?", a: "Maxwell is the fastest route when you want to scope a new build — it turns your idea into a clear brief and a working prototype. This form is right for everything else: audits, engineering support, upgrading an existing product, or general questions. Either way, a person reads your request." },
  { q: "Do I need a full spec before reaching out?", a: "No. Most projects start with a business problem, not a spec. Describe the problem in plain language and we'll turn it into a clear scope with you — what's in and out, agreed up front — before anything is built." },
  { q: "What happens after I send the form?", a: "We confirm we've received your inquiry within 2 business hours, your request reaches the right specialist within 24, and you get a substantive reply within 48. For a strong fit, we set up a discovery call within the week." },
  { q: "Can you work on something that already exists?", a: "Yes. Upgrade is our improvement path for products that already run, the Business Technology Audit maps what to cut, keep, or build across your stack, and Engineering Support embeds developers directly with your team." },
  { q: "Is what I share confidential?", a: "Yes — client work is treated as confidential. Anything we showcase publicly is anonymized: names, brands, and data are changed. Nothing identifiable is published without permission." },
  { q: "How is pricing handled?", a: "Pricing depends on scope and complexity. You get a transparent quote after the scoping phase — no hidden fees, no hourly billing surprises. You know the full cost before we start building." },
];

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ inquiry?: string; source?: string; draft?: string }>;
};

export default async function ContactRedesignPage({ params, searchParams }: Props) {
  const [{ locale }, { inquiry, source, draft }] = await Promise.all([params, searchParams]);
  const lp = (href: string) => `/${locale}${href}`;
  const normalizedInquiry = normalizeContactInquiry(inquiry);
  const trimmedDraft = (draft ?? "").trim();

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} ct-rd`}>
      <SiteNav locale={locale} active="contact" />

      {/* desktop: the framed region is the scroll container (native bar hidden,
          custom 4px overlay thumb floats inside the frame so divider lines stay
          full-bleed). mobile: normal document scroll. */}
      <ContactScroll>

      {/* HERO — type-led: headline left, copy + CTAs right */}
      <section className="ct-vhero">
        <div className="ct-wrap">
          <div className="ct-vhero-inner">
            <h1 className="ct-display">
              Let&apos;s talk.
            </h1>
            <div className="ct-vhero-bottom">
              <div className="ct-lead-bubble">
                <p className="ct-lead">
                  Tell us what you need, and we&apos;ll route it correctly. For project requests, we
                  review the inquiry first and then continue with the right next step.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT FORM — aside left, form right */}
      <section id="contact-form" className="ct-section" style={{ paddingTop: 0 }}>
        <div className="ct-wrap">
          <div className="ct-formsection">
            <div className="ct-formsection-inner">
              <div className="ct-formsection-aside">
                <div>
                  <h2 className="ct-h2">Start a conversation.</h2>
                  <p className="ct-body" style={{ marginTop: 14 }}>
                    Share what you&apos;re working on, what you need, or what you&apos;re exploring. The more context you give, the faster we can get back with something useful.
                  </p>
                </div>

              </div>

              {/* intake form (logic untouched; flattened + full-width submit via scoped CSS) */}
              <div className="ct-formsection-form min-w-0">
                <ContactIntakeForm
                  initialInquiry={normalizedInquiry}
                  initialSource={source}
                  initialDraft={trimmedDraft}
                  layout="stacked"
                  showGuidance={false}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAND — Noon's differentiator */}
      {/* RESPONSE COMMITMENT — stepped progress */}
      <section className="ct-section" style={{ paddingTop: 0 }}>
        <div className="ct-wrap">
          <div className="ct-sechead">
            <h2 className="ct-h2">Transparent communication, at every step.</h2>
          </div>
          <div className="ct-timeline">
            <div className="ct-timeline-grid">
              {TIMELINE.map((s, i) => (
                <div key={s.title} className="ct-tl-step">
                  <p className="ct-tl-num">0{i + 1}</p>
                  <div className="ct-tl-time">{s.time}</div>
                  <p className="ct-tl-title">{s.title}</p>
                  <p className="ct-tl-copy">{s.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="ct-section" style={{ paddingTop: 0 }}>
        <div className="ct-wrap">
          <div className="ct-sechead">
            <h2 className="ct-h2">Common questions.</h2>
          </div>
          <div className="ct-faq">
            {FAQS.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p className="ans">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* footer — shared across redesign pages */}
      <SiteFooterRd />
      </ContactScroll>
    </div>
  );
}
