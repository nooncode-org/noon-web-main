/**
 * tests/maxwell/asset-library.test.ts
 *
 * Fase A · E3.4 — NIVEL 0, our own library. What it must guarantee:
 *
 *   - only what the customs gate approved gets in (the caller filters, and
 *     the round-trip proves what comes back is what went in);
 *   - family and role are HARD boundaries — a warm-artisanal portrait must
 *     never surface for a fintech hero, which is the fidelity rule the
 *     library exists to serve, not to erode;
 *   - matching is by meaningful words, so "artisan bakery interior" finds
 *     the bakery photo and "dental clinic reception" does not;
 *   - a broken store costs nothing: lookups return empty and the cascade
 *     drops to the search, exactly as it would have anyway.
 */

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  archiveLibraryAssets,
  keywordsOf,
  lookupLibraryAssets,
} from "@/lib/maxwell/asset-library";
import type { StockImage } from "@/lib/server/stock-images";

function img(n: number): StockImage {
  return {
    url: `https://cdn.example/photo-${n}.jpg`,
    urlLarge: `https://cdn.example/photo-${n}@2x.jpg`,
    alt: `photo ${n}`,
    avgColor: "#8a6f4d",
  };
}

describe("keywordsOf", () => {
  it("keeps the words that carry meaning", () => {
    expect(keywordsOf("artisan bakery interior with warm morning light")).toEqual([
      "artisan",
      "bakery",
      "interior",
      "warm",
      "morning",
      "light",
    ]);
  });

  it("drops filler that would match everything", () => {
    expect(keywordsOf("a photo of the modern image")).toEqual([]);
  });
});

describe("asset library", () => {
  beforeEach(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "asset-library-"));
    vi.stubEnv("MAXWELL_DOSSIER_CACHE_DIR", dir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("files a verified winner and finds it again for the same family and role", async () => {
    await archiveLibraryAssets([
      {
        image: img(1),
        role: "hero",
        familyId: "warm-artisanal",
        query: "artisan bakery interior warm light",
      },
    ]);

    const found = await lookupLibraryAssets({
      familyId: "warm-artisanal",
      role: "hero",
      query: "bakery interior morning",
    });

    expect(found).toHaveLength(1);
    expect(found[0].url).toBe("https://cdn.example/photo-1.jpg");
    expect(found[0].alt).toBe("photo 1");
  });

  it("never crosses family or role boundaries", async () => {
    await archiveLibraryAssets([
      { image: img(1), role: "hero", familyId: "warm-artisanal", query: "bakery interior" },
    ]);

    expect(
      await lookupLibraryAssets({
        familyId: "tech-digital", // another family
        role: "hero",
        query: "bakery interior",
      }),
    ).toEqual([]);
    expect(
      await lookupLibraryAssets({
        familyId: "warm-artisanal",
        role: "portrait", // another role
        query: "bakery interior",
      }),
    ).toEqual([]);
  });

  it("returns nothing when no word actually overlaps", async () => {
    await archiveLibraryAssets([
      { image: img(1), role: "section", familyId: "warm-artisanal", query: "bakery interior" },
    ]);

    expect(
      await lookupLibraryAssets({
        familyId: "warm-artisanal",
        role: "section",
        query: "dental clinic reception",
      }),
    ).toEqual([]);
  });

  it("ranks the closest match first", async () => {
    await archiveLibraryAssets([
      { image: img(1), role: "section", familyId: "f", query: "bakery" },
      { image: img(2), role: "section", familyId: "f", query: "bakery bread oven" },
    ]);

    const found = await lookupLibraryAssets({
      familyId: "f",
      role: "section",
      query: "bakery bread oven",
    });

    expect(found[0].url).toBe("https://cdn.example/photo-2.jpg");
  });

  it("does not file the same photo twice", async () => {
    const entry = {
      image: img(1),
      role: "hero" as const,
      familyId: "f",
      query: "bakery interior",
    };
    await archiveLibraryAssets([entry]);
    await archiveLibraryAssets([entry]);

    const found = await lookupLibraryAssets({
      familyId: "f",
      role: "hero",
      query: "bakery interior",
    });
    expect(found).toHaveLength(1);
  });

  it("an empty or unreadable library costs nothing", async () => {
    expect(
      await lookupLibraryAssets({ familyId: "f", role: "hero", query: "anything at all" }),
    ).toEqual([]);
    // Archiving nothing is a no-op, not an error.
    await expect(archiveLibraryAssets([])).resolves.toBeUndefined();
  });
});
