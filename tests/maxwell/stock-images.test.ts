/**
 * tests/maxwell/stock-images.test.ts
 *
 * Fase A — the Pexels client's safety contract: unconfigured → null,
 * failures → null (never throws), photo mapping shape. `fetch` is stubbed;
 * vitest never touches the network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isStockImagesConfigured, searchStockImages } from "@/lib/server/stock-images";

const ORIGINAL_KEY = process.env.PEXELS_API_KEY;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.PEXELS_API_KEY;
  } else {
    process.env.PEXELS_API_KEY = ORIGINAL_KEY;
  }
});

describe("searchStockImages", () => {
  it("returns null without touching the network when the key is unset", async () => {
    delete process.env.PEXELS_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(isStockImagesConfigured()).toBe(false);
    const result = await searchStockImages({ query: "bakery", count: 2 });

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps Pexels photos to StockImage and skips entries without a src", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          photos: [
            {
              src: { large: "https://cdn/one-large", large2x: "https://cdn/one-2x" },
              alt: "A bakery counter",
              avg_color: "#DDCCAA",
            },
            { src: {} }, // no usable URL → dropped
            { src: { large: "https://cdn/two-large" }, alt: "" },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await searchStockImages({ query: "bakery interior", count: 3 });

    expect(result).toEqual([
      {
        url: "https://cdn/one-large",
        urlLarge: "https://cdn/one-2x",
        alt: "A bakery counter",
        avgColor: "#DDCCAA",
      },
      {
        url: "https://cdn/two-large",
        urlLarge: "https://cdn/two-large",
        // Empty alt falls back to the query so <img alt> is never blank.
        alt: "bakery interior",
        avgColor: null,
      },
    ]);
  });

  it("returns null on a non-OK response instead of throwing", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 429 }));

    await expect(searchStockImages({ query: "x", count: 1 })).resolves.toBeNull();
  });

  it("returns null when fetch itself rejects (network/timeout)", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("aborted"));

    await expect(searchStockImages({ query: "x", count: 1 })).resolves.toBeNull();
  });

  it("returns null when the API yields zero usable photos", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ photos: [] }), { status: 200 }),
    );

    await expect(searchStockImages({ query: "x", count: 1 })).resolves.toBeNull();
  });
});
