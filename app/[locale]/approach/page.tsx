import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SitePageFrame } from "@/app/_components/site/site-page-frame";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { getContactHref } from "@/lib/site-config";
import { BuildReceipt } from "@/components/sections/build-receipt";
import { HumanReviewProof } from "@/components/sections/human-review-proof";
import { FadeIn } from "@/components/ui/fade-in";

export const metadata: Metadata = {
  title: "The Noon approach | Noon",
  description:
    "The practices every Noon build runs on: scope before execution, AI as leverage, human review on every change, and code you own — delivered in increments.",
};

// /approach — the editorial manifesto page (Linear /method analog, audit P2):
// the human-review operating ideas as first-class content. Every principle
// line is drawn from copy that already ships (operating model, framing
// decisions, security pillars, commitments) — no new claims.

const PRINCIPLES: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Start from the problem",
    body: "The valuable conversation starts with operational friction, not a stack wishlist. We dig for the problem behind the request before proposing anything.",
  },
  {
    n: "02",
    title: "Scope before execution",
    body: "Maxwell turns the need into a clear scope — what's in and out, agreed up front — and a working prototype you can react to, before any production code is written.",
  },
  {
    n: "03",
    title: "AI is leverage, not judgment",
    body: "AI compresses the repetitive work. It doesn't remove the need for architecture or product judgment — that part stays human, on purpose.",
  },
  {
    n: "04",
    title: "Nothing ships without a person",
    body: "Every proposal is read, corrected, and approved by a PM. Every change is signed off by a senior engineer, line by line, before it reaches production.",
  },
  {
    n: "05",
    title: "Real code, real ownership",
    body: "Everything ships as production-ready code on a standard stack. The repository and the IP are yours — no lock-in, no black box.",
  },
  {
    n: "06",
    title: "Deliver in increments",
    body: "Working software in phases you can track — staging you can click, updates you can read — not a big-bang reveal at the end.",
  },
];

type ApproachPageProps = { params: Promise<{ locale: string }> };

export default async function ApproachPage({ params }: ApproachPageProps) {
  const { locale } = await params;
  const lp = (href: string) => `/${locale}${href}`;
  const viewer = await getAuthenticatedViewer();
  const contactHref = lp(getContactHref({ inquiry: "new-project", source: "approach" }));

  const chip =
    "inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-background px-2.5 py-0.5 text-[0.9em] font-medium text-foreground align-baseline transition-colors hover:border-primary/40 hover:text-primary";

  return (
    <SitePageFrame viewer={viewer}>
      <div className="site-shell py-12 lg:py-16">
        {/* manifesto hero */}
        <div className="mx-auto mb-14 max-w-3xl text-center lg:mb-20">
          <p className="site-meta-label mb-4 font-mono text-muted-foreground">The Noon approach</p>
          <h1 className="site-hero-title mb-5">
            Practices for software that lasts.
          </h1>
          <p className="site-hero-copy mx-auto max-w-xl text-muted-foreground">
            AI made building fast. These are the ideas that make it dependable — how every Noon
            build runs, from your first message to your sign-off.
          </p>
        </div>

        {/* numbered principles — hairline grid */}
        <FadeIn>
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[12px] border border-foreground/12">
          <div className="grid gap-px bg-foreground/10 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.n} className="flex flex-col gap-3 bg-background p-6 lg:p-7">
                <span className="font-mono text-[11px] text-primary">{p.n}</span>
                <h2 className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
                  {p.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
        </FadeIn>

        {/* the artifact: what a delivery actually looks like */}
        <div className="mx-auto mt-16 max-w-3xl text-center lg:mt-24">
          <span className="site-meta-label mb-4 inline-flex items-center justify-center gap-3 font-mono text-muted-foreground">
            <span className="h-px w-8 bg-foreground/30" />
            In practice
            <span className="h-px w-8 bg-foreground/30" />
          </span>
          <h2 className="site-section-title mb-3">What a delivery looks like.</h2>
          <p className="site-section-copy mx-auto mb-8 max-w-xl text-muted-foreground">
            Not a status meeting — a readable update: what was built, what the humans checked, and
            an explicit gate that waits for you.
          </p>
        </div>
        <FadeIn>
          <BuildReceipt />
        </FadeIn>
      </div>

      {/* the code-review artifact (shared section) — the wedge, shown not told */}
      <HumanReviewProof />

      {/* connective statement — the approach, proven elsewhere on the site */}
      <section className="site-section !pt-0">
        <div className="site-shell">
          <FadeIn>
          <p className="mx-auto max-w-2xl text-center text-[17px] leading-relaxed text-muted-foreground lg:text-[19px]">
            This page is the theory. See it proven in{" "}
            <Link href={lp("/work")} className={chip}>
              our work
            </Link>{" "}
            , hardened in{" "}
            <Link href={lp("/security")} className={chip}>
              security
            </Link>{" "}
            , and explained end to end in{" "}
            <Link href={lp("/about")} className={chip}>
              how we operate
            </Link>
            .
          </p>
          </FadeIn>
        </div>
      </section>

      {/* closing CTA */}
      <div className="site-shell pb-12 lg:pb-16">
        <div className="mx-auto max-w-3xl rounded-[12px] border border-foreground/10 bg-card/40 p-8 text-center">
          <h2 className="site-section-title mb-3">Build with this approach.</h2>
          <p className="site-section-copy mx-auto mb-5 max-w-xl text-muted-foreground">
            Tell us the problem. We&apos;ll scope it with you and ship it as real, human-reviewed
            software you own.
          </p>
          <Link
            href={contactHref}
            className="site-primary-action inline-flex h-11 items-center rounded-full px-6 text-sm font-medium"
          >
            Start a project
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </SitePageFrame>
  );
}
