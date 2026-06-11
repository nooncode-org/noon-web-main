import { ImageResponse } from "next/og";

// Shared Open Graph card for every marketing page (1200×630). Flat, on-brand:
// near-black surface, the noon wordmark, the page's headline, and the
// human-review tagline. Each route's opengraph-image.tsx calls buildOg() with
// its own title/subtitle — one design, consistent across every shared link.

export const OG_SIZE = { width: 1200, height: 630 };

const BG = "#050507";
const TEXT = "#f2f4f9";
const MUTED = "#9aa3b5";
const FAINT = "#6b7384";
const ACCENT = "#6a78ff"; // lifted brand for dark surface (raw #1200c5 reads black)

// Instrument Sans TTFs fetched once per server instance via Google's css2
// endpoint (an old UA gets truetype URLs — satori can't consume woff2).
let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 600 }[]> | null = null;
async function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const css = await (
        await fetch("https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;600", {
          headers: { "user-agent": "curl/8" },
        })
      ).text();
      const urls = [...css.matchAll(/font-weight:\s*(\d+);[^}]*?url\((https:[^)]+\.ttf)\)/g)];
      const out: { name: string; data: ArrayBuffer; weight: 400 | 600 }[] = [];
      for (const m of urls) {
        const weight = Number(m[1]) as 400 | 600;
        if (weight !== 400 && weight !== 600) continue;
        const data = await (await fetch(m[2])).arrayBuffer();
        out.push({ name: "Instrument Sans", data, weight });
      }
      return out;
    })().catch(() => []); // font failure → satori's bundled fallback still renders
  }
  return fontsPromise;
}

export async function buildOg(title: string, subtitle: string) {
  const fonts = await loadFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: "64px 72px",
          fontFamily: '"Instrument Sans", sans-serif',
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 46, fontWeight: 600, color: TEXT, letterSpacing: "-0.03em" }}>
            noon
          </span>
          <span style={{ fontSize: 22, color: FAINT, letterSpacing: "0.02em" }}>
            The code-first software company
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 980 }}>
          <span
            style={{
              fontSize: title.length > 46 ? 62 : 74,
              fontWeight: 600,
              color: TEXT,
              lineHeight: 1.06,
              letterSpacing: "-0.025em",
            }}
          >
            {title}
          </span>
          <span style={{ fontSize: 27, color: MUTED, lineHeight: 1.35 }}>{subtitle}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 14, height: 14, background: ACCENT, borderRadius: 3 }} />
          <span style={{ fontSize: 21, color: MUTED, letterSpacing: "0.16em" }}>
            EVERY BUILD HUMAN-REVIEWED
          </span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: fonts.length
        ? fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: "normal" as const }))
        : undefined,
    },
  );
}
