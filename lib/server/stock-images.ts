/**
 * lib/server/stock-images.ts
 *
 * Fase A del Quality Layer v2 — real stock photography for prototypes.
 *
 * The owner's rule: before generating, gather every resource the prototype
 * needs so v0 receives a COMPLETE brief — no gaps it has to fill with grey
 * rectangles or invented unsplash IDs (which 404 and read as broken).
 *
 * Provider: Pexels (https://www.pexels.com/api/) —
 *   - free API key, 200 req/hour / 20k per month,
 *   - hotlinking the CDN URLs is the documented usage,
 *   - photos are free to use under the Pexels license (no attribution required).
 *
 * Design constraints:
 *   - GRACEFUL DEGRADATION: no `PEXELS_API_KEY` → `searchStockImages` returns
 *     null and the caller simply builds the brief without an imagery block
 *     (exactly the pre-Fase-A behaviour). A missing key must never break
 *     prototype generation.
 *   - NEVER throws: network/API failures log and return null. The prototype
 *     route treats imagery as an enhancement, not a dependency.
 *   - Small timeout: a slow image search must not stall the whole generation
 *     kickoff (v0 itself is async; the client is watching a progress state).
 */

import { log } from "@/lib/server/logger";

export type StockImage = {
  /** Direct CDN URL, hotlinkable, already sized (Pexels `src.large` ≈ 940px wide). */
  url: string;
  /** Larger variant for hero use (`src.large2x` ≈ 1880px wide). */
  urlLarge: string;
  /** Pexels' human alt text — passed to v0 so `<img alt>` is real, not invented. */
  alt: string;
  /** Average color hex (e.g. "#6E7F5C") — lets v0 harmonize overlays/placeholders. */
  avgColor: string | null;
};

type PexelsPhoto = {
  src?: { large?: string; large2x?: string; original?: string };
  alt?: string;
  avg_color?: string;
};

const PEXELS_ENDPOINT = "https://api.pexels.com/v1/search";
const TIMEOUT_MS = 6_000;

export function isStockImagesConfigured(): boolean {
  return Boolean(process.env.PEXELS_API_KEY?.trim());
}

/**
 * Search Pexels for `count` photos matching `query`.
 * Returns null when unconfigured or on any failure; never throws.
 */
export async function searchStockImages(params: {
  query: string;
  count: number;
  orientation?: "landscape" | "portrait" | "square";
}): Promise<StockImage[] | null> {
  const apiKey = process.env.PEXELS_API_KEY?.trim();
  if (!apiKey) return null;

  const { query, count, orientation } = params;
  const url = new URL(PEXELS_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(Math.min(Math.max(count, 1), 15)));
  if (orientation) url.searchParams.set("orientation", orientation);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!res.ok) {
      log.warn("stock-images", "Pexels responded non-OK", {
        status: res.status,
        query,
      });
      return null;
    }

    const body = (await res.json()) as { photos?: PexelsPhoto[] };
    const photos = Array.isArray(body.photos) ? body.photos : [];

    const images = photos
      .map((p): StockImage | null => {
        const url = p.src?.large ?? p.src?.original;
        if (!url) return null;
        return {
          url,
          urlLarge: p.src?.large2x ?? p.src?.original ?? url,
          alt: (p.alt ?? "").trim() || query,
          avgColor: typeof p.avg_color === "string" ? p.avg_color : null,
        };
      })
      .filter((img): img is StockImage => img !== null);

    return images.length > 0 ? images : null;
  } catch (error) {
    log.warn("stock-images", "Pexels search failed", {
      query,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
