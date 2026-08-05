/**
 * tests/maxwell/reference-study.test.ts
 *
 * Entrega 1 (Fase A) — the study without a browser or an API key:
 *
 *   - parseDossierReply: the anti-adjective ficha's JSON contract —
 *     lenient (fences tolerated, optional arrays defaulted) but strict
 *     on the load-bearing fields (sections + whyItWorks), because a
 *     ficha without them cannot drive a creative order.
 *   - dossier cache: round-trip, URL normalization (fragment/query/
 *     trailing-slash/case variants share one ficha), corrupt file → null,
 *     staleness clock (spec: fichas caducan).
 *   - studyReference: cache hit never re-measures (the "se paga una vez"
 *     economics); measurement failure degrades to null (Regla 0).
 */

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseDossierReply } from "@/lib/maxwell/reference-study/dossier";
import {
  isDossierStale,
  normalizeReferenceUrl,
  readCachedDossier,
  writeCachedDossier,
} from "@/lib/maxwell/reference-study/dossier-cache";
import type { ReferenceMeasurements } from "@/lib/maxwell/reference-study/measure";

vi.mock("@/lib/maxwell/reference-study/measure", () => ({
  measureReference: vi.fn(),
}));
vi.mock("@/lib/maxwell/reference-study/dossier", async (importOriginal) => {
  const original = await importOriginal<object>();
  return { ...original, buildReferenceDossier: vi.fn() };
});

import { buildReferenceDossier } from "@/lib/maxwell/reference-study/dossier";
import { measureReference } from "@/lib/maxwell/reference-study/measure";
import { studyReference } from "@/lib/maxwell/reference-study/study";

function fakeMeasurements(url = "https://example.com"): ReferenceMeasurements {
  const page = {
    viewport: { width: 1440, height: 900 },
    fonts: [{ family: "Inter", weights: [400, 700] }],
    textStyles: [
      {
        role: "h1",
        fontFamily: "Inter",
        fontSizePx: 64,
        fontWeight: 700,
        lineHeight: 1.1,
        letterSpacingPx: -1,
      },
    ],
    palette: [{ hex: "#111111", role: "text" as const, count: 120 }],
    containerWidthPx: 1200,
    sections: [
      {
        index: 0,
        label: "section.hero",
        topPx: 0,
        heightPx: 700,
        paddingTopPx: 96,
        paddingBottomPx: 96,
        backgroundHex: "#ffffff",
      },
    ],
    sectionGapsPx: [120],
    borderRadiiPx: [8],
    boxShadows: [],
    buttons: [
      {
        backgroundHex: "#0056fd",
        textHex: "#ffffff",
        borderRadiusPx: 6,
        paddingPx: "10 18",
        fontSizePx: 14,
      },
    ],
  };
  return {
    url,
    measuredAt: new Date().toISOString(),
    desktop: page,
    mobile: { ...page, viewport: { width: 390, height: 844 } },
    captures: [],
  };
}

const VALID_REPLY = JSON.stringify({
  sections: [
    { label: "section.hero", purpose: "sell the bakery at a glance", pattern: "split 60/40, image right" },
  ],
  hierarchy: "h1 64px/700 vs body 16px/400",
  composition: "single column, 1200px container",
  uxPatterns: ["sticky header 64px"],
  ctas: [{ placement: "hero, left column", style: "#0056fd on white, 6px radius" }],
  imagery: [{ subject: "bread close-ups", treatment: "warm tone, 4:3" }],
  motion: [],
  responsive: "h1 drops to 40px, sections stack",
  whyItWorks: ["one accent color used 4 times total", "hero answers what+where in 2 lines"],
  heroRecipe: "left-aligned h1 64px, sub 18px, photo right 55%",
});

describe("parseDossierReply", () => {
  it("parses a valid reply and embeds the measured core", () => {
    const m = fakeMeasurements();
    const dossier = parseDossierReply(VALID_REPLY, m.url, m);
    expect(dossier).not.toBeNull();
    expect(dossier!.version).toBe(1);
    expect(dossier!.judged.sections[0].purpose).toContain("bakery");
    expect(dossier!.judged.whyItWorks).toHaveLength(2);
    expect(dossier!.measured.containerWidthPx).toBe(1200);
    expect(dossier!.measured.buttons[0].backgroundHex).toBe("#0056fd");
  });

  it("tolerates markdown fences around the JSON", () => {
    const m = fakeMeasurements();
    const fenced = "```json\n" + VALID_REPLY + "\n```";
    expect(parseDossierReply(fenced, m.url, m)).not.toBeNull();
  });

  it("rejects a reply missing the load-bearing fields", () => {
    const m = fakeMeasurements();
    const noSections = JSON.stringify({ whyItWorks: ["x"], sections: [] });
    const noWhy = JSON.stringify({
      sections: [{ label: "a", purpose: "b", pattern: "c" }],
      whyItWorks: [],
    });
    expect(parseDossierReply(noSections, m.url, m)).toBeNull();
    expect(parseDossierReply(noWhy, m.url, m)).toBeNull();
  });

  it("rejects non-JSON garbage", () => {
    const m = fakeMeasurements();
    expect(parseDossierReply("I could not analyze this page.", m.url, m)).toBeNull();
  });
});

describe("dossier cache", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "dossier-cache-"));
    vi.stubEnv("MAXWELL_DOSSIER_CACHE_DIR", dir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("round-trips a dossier and shares the entry across URL variants", async () => {
    const m = fakeMeasurements("https://example.com/menu");
    const dossier = parseDossierReply(VALID_REPLY, m.url, m)!;

    await writeCachedDossier("https://Example.com/menu/", dossier);
    const hit = await readCachedDossier("https://example.com/menu?utm=x#top");

    expect(hit).not.toBeNull();
    expect(hit!.dossier.judged.heroRecipe).toContain("64px");
    expect(isDossierStale(hit!.cachedAt)).toBe(false);
  });

  it("returns null for a cache miss", async () => {
    expect(await readCachedDossier("https://never-studied.example")).toBeNull();
  });

  it("normalizes fragments, queries, trailing slash and case", () => {
    const canonical = normalizeReferenceUrl("https://example.com/menu");
    expect(normalizeReferenceUrl("https://EXAMPLE.com/menu/")).toBe(canonical);
    expect(normalizeReferenceUrl("https://example.com/menu#hero")).toBe(canonical);
    expect(normalizeReferenceUrl("https://example.com/menu?ref=x")).toBe(canonical);
  });

  it("flags fichas past the expiry window as stale", () => {
    const fourMonthsAgo = new Date(Date.now() - 121 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDossierStale(fourMonthsAgo)).toBe(true);
    expect(isDossierStale(new Date().toISOString())).toBe(false);
    expect(isDossierStale("not-a-date")).toBe(true);
  });
});

describe("studyReference", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "dossier-study-"));
    vi.stubEnv("MAXWELL_DOSSIER_CACHE_DIR", dir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("serves from cache without re-measuring (se paga una vez)", async () => {
    const m = fakeMeasurements("https://poilane.example");
    const dossier = parseDossierReply(VALID_REPLY, m.url, m)!;
    await writeCachedDossier(m.url, dossier);

    const result = await studyReference(m.url);

    expect(result.source).toBe("cache");
    expect(result.dossier?.judged.heroRecipe).toContain("64px");
    expect(vi.mocked(measureReference)).not.toHaveBeenCalled();
  });

  it("degrades to null when measurement fails (Regla 0)", async () => {
    vi.mocked(measureReference).mockRejectedValueOnce(new Error("net::ERR_FAILED"));

    const result = await studyReference("https://down.example");

    expect(result).toEqual({ dossier: null, source: "none", stale: false });
  });

  it("measures, judges and caches on a fresh study", async () => {
    const m = fakeMeasurements("https://fresh.example");
    const dossier = parseDossierReply(VALID_REPLY, m.url, m)!;
    vi.mocked(measureReference).mockResolvedValueOnce(m);
    vi.mocked(buildReferenceDossier).mockResolvedValueOnce(dossier);

    const result = await studyReference(m.url);
    expect(result.source).toBe("fresh");

    const cached = await readCachedDossier(m.url);
    expect(cached?.dossier.judged.sections[0].label).toBe("section.hero");
  });
});
