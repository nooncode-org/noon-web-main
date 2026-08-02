/**
 * tests/maxwell/design-dossier.test.ts
 *
 * Fase A (Quality Layer v2) — the pre-generation resource gathering step.
 *
 * Contracts under guard:
 *   - graceful degradation: every search failing → null (generation must
 *     never block on imagery);
 *   - query composition: domain terms flavored with the pack aesthetic,
 *     falling back to the pack's imagery modifier when the classifier gave
 *     no domain queries;
 *   - de-duplication across buckets (a repeated photo reads as a bug).
 *
 * `lib/server/stock-images` is mocked — vitest never touches Pexels.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDesignDossier, dossierHasImagery } from "@/lib/maxwell/design-dossier";
import { getStylePackById } from "@/lib/maxwell/style-packs";
import type { StockImage } from "@/lib/server/stock-images";

vi.mock("@/lib/server/stock-images", () => ({
  searchStockImages: vi.fn(),
}));

import { searchStockImages } from "@/lib/server/stock-images";

const pack = getStylePackById("warm-artisanal")!;

function img(url: string): StockImage {
  return { url, urlLarge: `${url}?large`, alt: "alt text", avgColor: "#AABBCC" };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildDesignDossier", () => {
  it("returns null when every search degrades (unconfigured key)", async () => {
    vi.mocked(searchStockImages).mockResolvedValue(null);

    const dossier = await buildDesignDossier(["bakery interior"], pack);
    expect(dossier).toBeNull();
    expect(dossierHasImagery(dossier)).toBe(false);
  });

  it("flavors the hero query with the pack's aesthetic seed", async () => {
    vi.mocked(searchStockImages).mockResolvedValue(null);

    await buildDesignDossier(["bakery interior", "sourdough close-up"], pack);

    const queries = vi.mocked(searchStockImages).mock.calls.map(([p]) => p.query);
    expect(queries[0]).toBe("bakery interior, artisan craft");
    expect(queries[1]).toBe("sourdough close-up");
  });

  it("falls back to the pack imagery when the classifier gave no queries", async () => {
    vi.mocked(searchStockImages).mockResolvedValue(null);

    await buildDesignDossier([], pack);

    const queries = vi.mocked(searchStockImages).mock.calls.map(([p]) => p.query);
    expect(queries[0]).toBe(pack.token.imagery);
    expect(queries[1]).toBe(pack.token.imagery);
  });

  it("assembles role buckets and de-dupes repeated photos across them", async () => {
    vi.mocked(searchStockImages)
      .mockResolvedValueOnce([img("https://p/hero1"), img("https://p/shared")])
      .mockResolvedValueOnce([img("https://p/shared"), img("https://p/support1")])
      .mockResolvedValueOnce([img("https://p/face1")]);

    const dossier = await buildDesignDossier(["bakery"], pack);

    expect(dossierHasImagery(dossier)).toBe(true);
    expect(dossier!.hero.map((i) => i.url)).toEqual(["https://p/hero1", "https://p/shared"]);
    // The duplicate stayed in the FIRST bucket that claimed it.
    expect(dossier!.support.map((i) => i.url)).toEqual(["https://p/support1"]);
    expect(dossier!.portraits.map((i) => i.url)).toEqual(["https://p/face1"]);
  });

  it("survives one bucket failing while others succeed", async () => {
    vi.mocked(searchStockImages)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([img("https://p/support1")])
      .mockResolvedValueOnce(null);

    const dossier = await buildDesignDossier(["bakery"], pack);

    expect(dossierHasImagery(dossier)).toBe(true);
    expect(dossier!.hero).toEqual([]);
    expect(dossier!.support).toHaveLength(1);
  });
});
