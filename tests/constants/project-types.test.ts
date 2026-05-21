/**
 * tests/constants/project-types.test.ts
 *
 * v3 prep — pins the canonical project-type vocabulary + the legacy
 * platform mapping. Goals:
 *
 *   1. Lock the 5 canonical values so a future cleanup that adds /
 *      removes a category in `proposal-rules.ts` is forced through a
 *      conscious test edit. The cross-repo contract depends on this
 *      tuple staying in sync with App-side.
 *
 *   2. Pin the legacy platform → canonical mapping decisions so the
 *      "what does 'both' map to?" question doesn't get re-litigated
 *      every six months — the test IS the doc.
 *
 *   3. Verify `normalizeProjectType` returns null (not a default) for
 *      unknown input. Returning a default would hide bugs in upstream
 *      data validation.
 */

import { describe, expect, it } from "vitest";

import { PROJECT_CATEGORIES } from "@/lib/maxwell/proposal-rules";
import {
  CANONICAL_PROJECT_TYPES,
  LEGACY_PLATFORM_TO_PROJECT_TYPE,
  canonicalToLegacyPlatform,
  isCanonicalProjectType,
  normalizeProjectType,
} from "@/lib/constants/project-types";

describe("CANONICAL_PROJECT_TYPES", () => {
  it("matches the keys of PROJECT_CATEGORIES (single source of truth)", () => {
    // If this fails after adding/removing a category in proposal-rules,
    // update the canonical list deliberately (no auto-sync to keep the
    // cross-repo contract change explicit + reviewable).
    expect([...CANONICAL_PROJECT_TYPES].sort()).toEqual(
      Object.keys(PROJECT_CATEGORIES).sort(),
    );
  });

  it("contains the 5 known canonical types in some order", () => {
    expect([...CANONICAL_PROJECT_TYPES].sort()).toEqual([
      "ecommerce",
      "landing",
      "mobile",
      "saas_ai",
      "webapp",
    ]);
  });
});

describe("isCanonicalProjectType", () => {
  it("returns true for each canonical value", () => {
    for (const t of CANONICAL_PROJECT_TYPES) {
      expect(isCanonicalProjectType(t)).toBe(true);
    }
  });

  it("returns false for legacy platform strings", () => {
    expect(isCanonicalProjectType("web")).toBe(false);
    expect(isCanonicalProjectType("both")).toBe(false);
    expect(isCanonicalProjectType("unknown")).toBe(false);
  });

  it("returns false for non-string inputs", () => {
    expect(isCanonicalProjectType(null)).toBe(false);
    expect(isCanonicalProjectType(undefined)).toBe(false);
    expect(isCanonicalProjectType(42)).toBe(false);
    expect(isCanonicalProjectType({})).toBe(false);
  });

  it("returns false for empty + whitespace strings", () => {
    expect(isCanonicalProjectType("")).toBe(false);
    expect(isCanonicalProjectType("   ")).toBe(false);
  });
});

describe("LEGACY_PLATFORM_TO_PROJECT_TYPE", () => {
  it("maps web → landing (conservative default)", () => {
    expect(LEGACY_PLATFORM_TO_PROJECT_TYPE.web).toBe("landing");
  });

  it("maps mobile → mobile (exact)", () => {
    expect(LEGACY_PLATFORM_TO_PROJECT_TYPE.mobile).toBe("mobile");
  });

  it("maps both → webapp (cross-platform implies an app)", () => {
    expect(LEGACY_PLATFORM_TO_PROJECT_TYPE.both).toBe("webapp");
  });

  it("maps unknown → null (don't silently default)", () => {
    expect(LEGACY_PLATFORM_TO_PROJECT_TYPE.unknown).toBeNull();
  });
});

describe("normalizeProjectType", () => {
  it("returns canonical values as-is", () => {
    for (const t of CANONICAL_PROJECT_TYPES) {
      expect(normalizeProjectType(t)).toBe(t);
    }
  });

  it("translates legacy platform values to canonical", () => {
    expect(normalizeProjectType("web")).toBe("landing");
    expect(normalizeProjectType("mobile")).toBe("mobile");
    expect(normalizeProjectType("both")).toBe("webapp");
  });

  it("returns null for the legacy 'unknown' sentinel", () => {
    expect(normalizeProjectType("unknown")).toBeNull();
  });

  it("is case-insensitive on legacy platform values", () => {
    expect(normalizeProjectType("WEB")).toBe("landing");
    expect(normalizeProjectType("Mobile")).toBe("mobile");
    expect(normalizeProjectType("Both")).toBe("webapp");
  });

  it("trims whitespace before matching", () => {
    expect(normalizeProjectType("  landing  ")).toBe("landing");
    expect(normalizeProjectType("\tweb\n")).toBe("landing");
  });

  it("returns null for null / undefined / empty string", () => {
    expect(normalizeProjectType(null)).toBeNull();
    expect(normalizeProjectType(undefined)).toBeNull();
    expect(normalizeProjectType("")).toBeNull();
    expect(normalizeProjectType("   ")).toBeNull();
  });

  it("returns null for unknown free text (does NOT silently default)", () => {
    // Critical: unknown free text returning a canonical value would
    // hide upstream bugs. Caller must decide whether to use a default
    // (e.g. `webapp`) or surface the error.
    expect(normalizeProjectType("e-commerce")).toBeNull(); // hyphen typo
    expect(normalizeProjectType("WebApp")).toBeNull();     // camelCase
    expect(normalizeProjectType("ai-saas")).toBeNull();    // reordered
    expect(normalizeProjectType("random nonsense")).toBeNull();
  });
});

describe("canonicalToLegacyPlatform", () => {
  it("maps the entire canonical set to a legacy bucket", () => {
    expect(canonicalToLegacyPlatform("landing")).toBe("web");
    expect(canonicalToLegacyPlatform("ecommerce")).toBe("web");
    expect(canonicalToLegacyPlatform("webapp")).toBe("both");
    expect(canonicalToLegacyPlatform("mobile")).toBe("mobile");
    expect(canonicalToLegacyPlatform("saas_ai")).toBe("web");
  });

  it("round-trips for values that have an unambiguous reverse", () => {
    // The lossy direction means most canonical values don't survive
    // a round-trip; we only assert the ones that DO.
    expect(
      normalizeProjectType(canonicalToLegacyPlatform("mobile")),
    ).toBe("mobile");
  });

  it("covers every canonical type (no missing case)", () => {
    // If a new canonical type is added without a switch arm,
    // TypeScript catches it at compile time; this test catches it at
    // runtime in case the switch ever uses default fallthrough.
    for (const t of CANONICAL_PROJECT_TYPES) {
      const legacy = canonicalToLegacyPlatform(t);
      expect(["web", "mobile", "both"]).toContain(legacy);
    }
  });
});
