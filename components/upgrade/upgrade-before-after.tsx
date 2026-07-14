"use client";

/**
 * UpgradeBeforeAfter — a fictional furniture store ("norr-furniture.com"),
 * shown twice: its dated original, and the version Maxwell would rebuild it
 * into. Same store, same products, same prices — only the design changes, so
 * the transformation reads 1:1 instead of as two unrelated sites.
 *
 * Each mockup is a real, fully self-contained interactive HTML document
 * (served statically from /public/mockups/) rendered inside an iframe at its
 * native 1280px desktop width, then visually scaled down to fit the card via
 * CSS transform — NOT a responsive resize, which would trip the mockup's own
 * ≤960px mobile layout and defeat the comparison. The card crops to a fixed
 * aspect ratio (nav + hero + a peek of the next section), matching the
 * browser-chrome framing already used by <UpgradeDemo>.
 *
 * `compact`: the small, stacked pair used beside the hero copy — same crop/
 * scaling mechanics, just narrower, with the long caption dropped (no room)
 * and tighter chrome so two can stack without dominating the hero.
 */

import { useEffect, useRef, useState } from "react";

// Rendered wider than the mockup's own --wrap (1220px + padding = 1276px) so
// its natural side margins are visible instead of the content running edge-to-
// edge into this card's border — 1280 (~= wrap's own max width) left almost no
// breathing room once scaled down. Height keeps the same 1280:860 ratio, so
// the card's on-page proportions/size are unchanged — this only widens the
// field of view into the mockup.
const SOURCE_WIDTH = 1440;
const CROP_HEIGHT = Math.round(SOURCE_WIDTH * (860 / 1280)); // 968

function MockupPreview({
  src,
  label,
  domain,
  caption,
  compact = false,
}: {
  src: string;
  label: string;
  domain: string;
  caption: string;
  compact?: boolean;
}) {
  const wrapRef = useRef<HTMLAnchorElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.offsetWidth / SOURCE_WIDTH);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="min-w-0">
      {!compact && <p className="upg-kicker mb-3">{label}</p>}
      <div className="min-w-0 overflow-hidden rounded-[12px] border border-foreground/10 bg-background shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)]">
        {/* browser-window chrome — mirrors <UpgradeDemo>; skipped in compact
            (the hero cards), which dropped the dots/domain header entirely */}
        {!compact && (
          <div className="flex items-center gap-2 border-b border-foreground/10 bg-secondary/40 px-4 py-2.5">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            </div>
            <div className="ml-2 flex-1 truncate rounded-md bg-background/70 px-3 py-1 text-center text-xs text-muted-foreground">
              {domain}
            </div>
          </div>
        )}

        {/* scaled, cropped preview — click opens the full interactive mockup */}
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open the full ${label.toLowerCase()} example in a new tab`}
          ref={wrapRef}
          className="relative block w-full overflow-hidden bg-background"
          style={{ aspectRatio: `${SOURCE_WIDTH} / ${CROP_HEIGHT}` }}
        >
          {scale > 0 && (
            <iframe
              src={src}
              tabIndex={-1}
              scrolling="no"
              loading="lazy"
              title={`${label} — ${domain}`}
              style={{
                width: SOURCE_WIDTH,
                height: CROP_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                border: 0,
                pointerEvents: "none",
              }}
            />
          )}
        </a>

        {/* caption + explicit link — mirrors <UpgradeDemo>'s footer bar. Compact
            drops the descriptive caption (no room beside the hero copy) and
            keeps just the click-through affordance. */}
        {compact ? (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="block border-t border-foreground/10 px-3 py-2 text-center text-sm text-foreground/70 hover:text-foreground"
          >
            {label}
          </a>
        ) : (
          <div className="flex items-center justify-between gap-3 border-t border-foreground/10 px-5 py-3 text-xs text-muted-foreground">
            <span>{caption}</span>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-foreground/85 underline-offset-4 hover:underline"
            >
              View full example →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// Decorative "one site, two outcomes" connector — a rounded circuit trace
// branching from a shared point down into each card, with a resistor
// squiggle marking the transformation in between. Desktop-only (hidden when
// the cards stack): the branch metaphor only reads when they sit side by
// side. Coordinates are tuned against the cards' actual on-page proportions
// (measured: each card ~48.7% wide, centers at ~24.3% / ~75.7%) and the SVG
// scales as a whole (no preserveAspectRatio override), so the geometry stays
// proportional at any container width.
function ProofConnector() {
  return (
    <svg
      viewBox="0 0 602 70"
      fill="none"
      aria-hidden="true"
      className="mb-3 hidden w-full sm:block"
    >
      <defs>
        {/* indigo / blue / violet — blue plus its two closest, cool-family
            neighbors — no green/red/yellow, kept to hues that read as
            "blue and friends." */}
        <linearGradient id="proofConnectorGradient" x1="146.5" y1="0" x2="455.5" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5b5bff" />
          <stop offset="45%" stopColor="#1b9aff" />
          <stop offset="55%" stopColor="#1b9aff" />
          <stop offset="100%" stopColor="#b15bff" />
        </linearGradient>
      </defs>
      {/* staple: up the left leg, rounded corner, across the top, rounded corner, down the right leg */}
      <path
        d="M146.5 58 L146.5 28 Q146.5 14 160.5 14 L441.5 14 Q455.5 14 455.5 28 L455.5 58"
        stroke="url(#proofConnectorGradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* arrowheads */}
      <polygon points="146.5,69 140,58 153,58" fill="url(#proofConnectorGradient)" />
      <polygon points="455.5,69 449,58 462,58" fill="url(#proofConnectorGradient)" />
    </svg>
  );
}

const MOCKUPS = [
  {
    src: "/mockups/tienda-antes.html",
    label: "Before",
    domain: "norr-furniture.com",
    caption: "The store's original site — dated, cluttered, off-the-shelf.",
  },
  {
    src: "/mockups/tienda-despues.html",
    label: "After",
    domain: "norr-furniture.com",
    caption: "Rebuilt by Maxwell — same catalog, modern and considered.",
  },
] as const;

export function UpgradeBeforeAfter({ compact = false }: { compact?: boolean }) {
  return (
    <div>
      {compact && <ProofConnector />}
      <div className={compact ? "upg-hero-proof-cards" : "grid gap-6 md:grid-cols-2"}>
        {MOCKUPS.map((m) => (
          <MockupPreview key={m.src} {...m} compact={compact} />
        ))}
      </div>
    </div>
  );
}
