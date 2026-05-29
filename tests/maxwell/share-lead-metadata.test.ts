/**
 * tests/maxwell/share-lead-metadata.test.ts
 *
 * Pure-function coverage for the share-flow lead enrichment helper
 * (`buildShareLeadMetadata` + `parseActivationAmountUsd`). The helper is
 * the source of truth for what NoonWeb sends in `metadata.score`,
 * `metadata.amount`, and the pricing trio on the `prototype-share` wire
 * — App's `insertFreshLeadForShare` reads these to populate
 * `leads.score` / `leads.value`.
 *
 * Out of scope here:
 *   - The Server Action wiring (it just delegates; covered by integration
 *     when bilateral smoke happens post-merge).
 *   - App-side handler behaviour (lives in App repo).
 */

import { describe, expect, it } from "vitest";
import type { StudioSession } from "@/lib/maxwell/repositories";
import {
  SHARE_LEAD_BASELINE_SCORE,
  buildShareLeadMetadata,
  parseActivationAmountUsd,
} from "@/lib/maxwell/share-lead-metadata";

function makeSession(overrides: Partial<StudioSession> = {}): StudioSession {
  return {
    id: "sess-1",
    initialPrompt: "Build a booking platform for a yoga studio",
    status: "prototype_ready",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    ownerImage: null,
    projectType: null,
    goalSummary: "Yoga studio booking",
    complexityHint: null,
    language: "en",
    correctionsUsed: 0,
    maxCorrections: 2,
    proposalRequestedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stylePackId: null,
    prototypeWorkspaceId: null,
    shareToken: null,
    shareTokenUrl: null,
    prototypeSharedAt: null,
    ...overrides,
  };
}

describe("parseActivationAmountUsd", () => {
  it.each([
    ["$1200 USD", 1200],
    ["$1,200", 1200],
    ["$1200", 1200],
    ["1200", 1200],
    ["$1,234.56", 1234.56],
    ["$0", 0],
    ["  $999.99 USD ", 999.99],
  ])("parses %s to %s", (input, expected) => {
    expect(parseActivationAmountUsd(input)).toBe(expected);
  });

  it.each([
    [""],
    ["no digits at all"],
    ["$$$$"],
  ])("returns 0 for unparseable input %s", (input) => {
    expect(parseActivationAmountUsd(input)).toBe(0);
  });

  it("treats commas as thousands separators, not decimals", () => {
    // Distinct from European notation; matches the PRICING_TABLE convention
    // (US-style strings like "$1,200" represent 1200 not 1.2).
    expect(parseActivationAmountUsd("$1,200")).toBe(1200);
    expect(parseActivationAmountUsd("$1,234.56")).toBe(1234.56);
  });
});

describe("buildShareLeadMetadata", () => {
  it("returns the constant baseline score (80) regardless of session", () => {
    const meta = buildShareLeadMetadata(makeSession());
    expect(meta.score).toBe(SHARE_LEAD_BASELINE_SCORE);
    expect(meta.score).toBe(80);
  });

  it("derives a positive amount from the resolved commercial profile", () => {
    // The exact value depends on PRICING_TABLE, but for any session resolvable
    // against the table it should be a finite positive number.
    const meta = buildShareLeadMetadata(
      makeSession({ projectType: "landing", complexityHint: "bajo" }),
    );
    expect(meta.amount).toBeGreaterThan(0);
    expect(Number.isFinite(meta.amount)).toBe(true);
  });

  it("emits a category from PROJECT_CATEGORIES and tier from COMPLEXITY_TIERS", () => {
    const meta = buildShareLeadMetadata(
      makeSession({ projectType: "ecommerce", complexityHint: "medio" }),
    );
    // We don't assert exact category/tier here because resolveProjectCategory
    // does its own heuristic — we just assert the shape is non-empty strings.
    expect(typeof meta.pricing_category).toBe("string");
    expect(meta.pricing_category.length).toBeGreaterThan(0);
    expect(typeof meta.pricing_tier).toBe("string");
    expect(meta.pricing_tier.length).toBeGreaterThan(0);
  });

  it("surfaces the membership_recommended flag from the profile", () => {
    const meta = buildShareLeadMetadata(makeSession());
    expect(typeof meta.membership_recommended).toBe("boolean");
  });

  it("does not depend on session.id or owner identifying fields (pure mapping)", () => {
    // Sanity: two sessions identical in product shape but with different
    // ids/owners produce the same enrichment metadata.
    const a = buildShareLeadMetadata(
      makeSession({ id: "a", ownerEmail: "a@x.com", goalSummary: "Landing" }),
    );
    const b = buildShareLeadMetadata(
      makeSession({ id: "b", ownerEmail: "b@x.com", goalSummary: "Landing" }),
    );
    expect(a).toEqual(b);
  });
});
