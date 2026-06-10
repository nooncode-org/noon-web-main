"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { EASE } from "@/lib/motion";
import { useRevealMotion } from "@/hooks/use-reveal-motion";
import { Eyebrow } from "@/components/ui/eyebrow";

// IndustryShift — "The shift": real, verified public statements from the people
// running the frontier labs (2026-weighted), framed as INDUSTRY CONTEXT, never
// as endorsements of Noon. Portraits are CC-BY photos from Wikimedia Commons
// (see public/work/voices/CREDITS.md); the CC license itself forbids implying
// the subject endorses this use, which matches the framing. The arc: AI now
// writes most of the code (Pichai, Huang, Amodei) → a human still reviews and
// accepts what ships (Pichai's own words, accented) → that review is Noon's
// product. Each quote carries name, role, source + date so it's verifiable.

const HERO = {
  quote: "75% of all new code at Google is now AI-generated — and ",
  highlight: "approved by engineers.",
  name: "Sundar Pichai",
  role: "CEO, Alphabet",
  source: "Google Cloud Next 2026",
  href: "https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/cloud-next-2026-sundar-pichai/",
  avatar: "/work/voices/sundar-pichai-g.jpg",
};

const VOICES: {
  quote: string;
  name: string;
  role: string;
  source: string;
  href: string;
  avatar: string;
}[] = [
  {
    quote:
      "…explaining to the AI what we want — our intent — and the AI generates the code.",
    name: "Jensen Huang",
    role: "CEO, NVIDIA",
    source: "NVIDIA GTC Taipei 2026",
    // official keynote page (with replay video) where he said it — the recap
    // article only paraphrases the line, so it links to the primary source.
    href: "https://www.nvidia.com/en-tw/gtc/taipei/keynote/",
    avatar: "/work/voices/jensen-huang.jpg",
  },
  {
    quote: "We're 3 to 6 months from a world where AI is writing 90% of the code.",
    name: "Dario Amodei",
    role: "CEO, Anthropic",
    source: "Council on Foreign Relations, 2025",
    href: "https://finance.yahoo.com/news/anthropic-ceo-says-ai-could-193020957.html",
    avatar: "/work/voices/amodei.jpg",
  },
  {
    // his real post, quoted clean (not a literal embed) — the source links to it
    quote: "The hottest new programming language is English.",
    name: "Andrej Karpathy",
    role: "Founding member, OpenAI",
    source: "on X · 2023",
    href: "https://x.com/karpathy/status/1617979122625712128",
    avatar: "/work/voices/andrej-karpathy.jpg",
  },
];

function Avatar({ src, name }: { src: string; name: string }) {
  return (
    <Image
      src={src}
      alt={`${name} portrait`}
      width={44}
      height={44}
      className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-foreground/10"
    />
  );
}

export function IndustryShift() {
  // Reveal-on-scroll that is reduced-motion- and SSR-safe: `show` is true during
  // SSR + first paint (no hydration mismatch; content present without JS) and
  // always for reduced-motion users (the quotes + source links never hide behind
  // a scroll), then tracks scroll-into-view for everyone else.
  const { ref, show } = useRevealMotion({ margin: "-80px" });

  return (
    <section className="site-section">
      <div className="site-shell">
        <div ref={ref} className="mx-auto max-w-5xl">
          {/* eyebrow + headline + lead */}
          <div className="max-w-2xl">
            <Eyebrow>The shift</Eyebrow>
            <h2 className="site-section-title mt-4">
              AI writes the code now. Someone still has to be sure.
            </h2>
            <p className="site-section-copy mt-3 text-muted-foreground">
              We don&apos;t hide that Noon builds with AI — and in 2026 the people running the
              frontier labs are saying it out loud. The constant in every version: a human still
              reads, reviews, and accepts what ships.
            </p>
          </div>

          {/* hero — Pichai (the human-review clause is the whole point) */}
          <motion.figure
            initial={false}
            animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.55, ease: EASE }}
            className="mt-9 rounded-[14px] border border-foreground/12 bg-card/30 p-6 lg:mt-12 lg:p-8"
          >
            <blockquote className="text-[20px] font-medium leading-snug tracking-[-0.01em] text-foreground lg:text-[27px]">
              &ldquo;{HERO.quote}
              <span className="text-primary">{HERO.highlight}</span>&rdquo;
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <Avatar src={HERO.avatar} name={HERO.name} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{HERO.name}</div>
                <div className="text-[13px] text-muted-foreground">
                  {HERO.role} ·{" "}
                  <a
                    href={HERO.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[11px] text-muted-foreground/60 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  >
                    {HERO.source} ↗
                  </a>
                </div>
              </div>
            </figcaption>
          </motion.figure>

          {/* supporting voices */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VOICES.map((v, i) => (
              <motion.figure
                key={v.name}
                initial={false}
                animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.12 + i * 0.08 }}
                className="flex flex-col rounded-[14px] border border-foreground/12 bg-card/30 p-6"
              >
                <blockquote className="text-[15px] leading-relaxed text-foreground/90">
                  &ldquo;{v.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3 pt-5">
                  <Avatar src={v.avatar} name={v.name} />
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-foreground">{v.name}</div>
                    <div className="text-[12.5px] text-muted-foreground">
                      {v.role} ·{" "}
                      <a
                        href={v.href}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[10.5px] text-muted-foreground/60 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                      >
                        {v.source} ↗
                      </a>
                    </div>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </div>

          {/* attribution + bridge into the human-review proof that follows */}
          <p className="mt-5 font-mono text-[10.5px] leading-relaxed text-muted-foreground/50">
            Portraits via Wikimedia Commons (CC BY / GODL) and official author photos. Public
            statements — shown as industry context, not endorsements of Noon.
          </p>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground lg:mt-8">
            <span className="font-medium text-foreground">
              Noon is built on the half that doesn&apos;t get automated.
            </span>{" "}
            Every build is AI-accelerated and signed off by a senior engineer, line by line.
          </p>
        </div>
      </div>
    </section>
  );
}
