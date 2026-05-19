/**
 * tests/maxwell/style-packs.test.ts
 *
 * Catalogue invariants for the 24 visual style families (Bloque 11).
 *
 * These are guard-rail tests, not behavioural ones. The catalogue is the
 * source of truth for what the classifier can return; if it drifts (typo in
 * id, missing ref, ids duplicated) the runtime degrades silently to a
 * fallback. Tests here surface those mistakes at vitest time.
 */

import { describe, expect, it } from "vitest";
import {
  STYLE_PACKS,
  getStylePackById,
  getStylePackByName,
} from "@/lib/maxwell/style-packs";

describe("STYLE_PACKS catalogue", () => {
  it("contains exactly 24 packs (the documented count)", () => {
    expect(STYLE_PACKS).toHaveLength(24);
  });

  it("uses unique pack ids (no collisions across the catalogue)", () => {
    const ids = STYLE_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses unique pack names", () => {
    const names = STYLE_PACKS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses kebab-case ids (so they match the DB column shape)", () => {
    for (const pack of STYLE_PACKS) {
      expect(pack.id, `Pack "${pack.name}" id`).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it("every pack has exactly 3 reference URLs (classifier contract)", () => {
    for (const pack of STYLE_PACKS) {
      expect(pack.refs, `Pack "${pack.name}" refs`).toHaveLength(3);
    }
  });

  it("every reference URL is non-empty", () => {
    for (const pack of STYLE_PACKS) {
      for (const ref of pack.refs) {
        expect(ref.url.trim(), `Pack "${pack.name}" ref url`).not.toBe("");
      }
    }
  });

  it("every pack has a non-empty feel description (used in the prompt)", () => {
    for (const pack of STYLE_PACKS) {
      expect(pack.feel.trim(), `Pack "${pack.name}" feel`).not.toBe("");
    }
  });

  it("includes the deterministic fallbacks the classifier expects", () => {
    // These ids are hardcoded into style-classifier.ts PROJECT_TYPE_FALLBACK.
    // If a pack is renamed without updating the classifier, the fallback path
    // returns the final default instead of the intended family.
    for (const id of [
      "clean-professional",
      "commerce-retail",
      "tech-digital",
    ]) {
      expect(getStylePackById(id), `expected pack "${id}" in catalogue`).toBeDefined();
    }
  });
});

describe("getStylePackById", () => {
  it("returns the pack when the id exists", () => {
    const pack = getStylePackById("tech-digital");
    expect(pack?.name).toBe("Tech & Digital");
  });

  it("returns undefined for an unknown id (caller must handle)", () => {
    expect(getStylePackById("not-a-real-pack")).toBeUndefined();
  });
});

describe("getStylePackByName", () => {
  it("matches exact name", () => {
    expect(getStylePackByName("Tech & Digital")?.id).toBe("tech-digital");
  });

  it("matches case-insensitively (LLM may return inconsistent casing)", () => {
    expect(getStylePackByName("TECH & DIGITAL")?.id).toBe("tech-digital");
    expect(getStylePackByName("tech & digital")?.id).toBe("tech-digital");
  });

  it("trims surrounding whitespace", () => {
    expect(getStylePackByName("  Tech & Digital  ")?.id).toBe("tech-digital");
  });

  it("returns undefined when no name matches", () => {
    expect(getStylePackByName("Made Up Family")).toBeUndefined();
  });
});
