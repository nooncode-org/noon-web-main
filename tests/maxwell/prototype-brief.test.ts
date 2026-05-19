/**
 * tests/maxwell/prototype-brief.test.ts
 *
 * Bloque 11 — buildPrototypeBrief / buildCorrectionBrief are pure functions,
 * so we test them at the string level. The contract these tests guard:
 *
 *   - Section markers (// ─── 1, 2, 3, 4, 5 ───) appear in the right order.
 *   - Section 4 (PRODUCT CONTEXT) is OMITTED when brief is null — the
 *     graceful-degradation path matters because the fire-and-forget extractor
 *     may not have finished yet.
 *   - References block formats with v0Hint when present and without when not.
 *   - The web_landing exception line shows up ONLY for that project type.
 *   - buildCorrectionBrief passes through unchanged when no style pack.
 */

import { describe, expect, it } from "vitest";
import {
  buildCorrectionBrief,
  buildPrototypeBrief,
  type HistoryMessage,
} from "@/lib/maxwell/prototype-brief";
import type { StudioBrief, StudioSession } from "@/lib/maxwell/repositories";
import type { StylePack } from "@/lib/maxwell/style-packs";

function fakeSession(overrides: Partial<StudioSession> = {}): StudioSession {
  return {
    id: "session-1",
    initialPrompt: "Build a fintech onboarding flow",
    status: "generating_prototype",
    ownerEmail: "owner@example.com",
    ownerName: "Owner",
    ownerImage: null,
    projectType: "webapp_system",
    goalSummary: "Onboarding flow for crypto users",
    complexityHint: "medium",
    language: "en",
    correctionsUsed: 0,
    maxCorrections: 3,
    proposalRequestedAt: null,
    createdAt: "2026-05-17T00:00:00Z",
    updatedAt: "2026-05-17T00:00:00Z",
    stylePackId: null,
    ...overrides,
  };
}

function fakeBrief(overrides: Partial<StudioBrief> = {}): StudioBrief {
  return {
    id: "brief-1",
    studioSessionId: "session-1",
    objective: "Reduce onboarding drop-off",
    users: "Crypto-curious retail investors",
    primaryUser: "First-time investor",
    coreFlow: "Email → KYC → fund account → first trade",
    platform: "web",
    styleDirection: "Calm, dark mode, financial trust signals",
    integrations: null,
    assumptions: null,
    constraints: null,
    answersJson: {},
    createdAt: "2026-05-17T00:00:00Z",
    updatedAt: "2026-05-17T00:00:00Z",
    ...overrides,
  };
}

function fakePack(overrides: Partial<StylePack> = {}): StylePack {
  return {
    id: "finance-fintech",
    name: "Finance & Fintech",
    feel: "Consumer investing / international payments / crypto exchange.",
    refs: [
      { url: "robinhood.com", v0Hint: "Investing consumer / dark bold" },
      { url: "wise.com" }, // intentionally no v0Hint to exercise both branches
      { url: "coinbase.com", v0Hint: "Cripto exchange / blue clean" },
    ],
    ...overrides,
  };
}

describe("buildPrototypeBrief", () => {
  const baseHistory: HistoryMessage[] = [
    { role: "user", content: "I want a wallet onboarding for crypto." },
    { role: "assistant", content: "What is the primary user persona?" },
  ];

  it("emits all 5 section headers in order when brief is present", () => {
    const out = buildPrototypeBrief(
      fakeSession(),
      fakeBrief(),
      baseHistory,
      "First-time crypto investors",
      "Got it, building the prototype now.",
      fakePack(),
    );

    const order = [
      out.indexOf("1. MASTER INSTRUCTION"),
      out.indexOf("2. WHAT TO BUILD"),
      out.indexOf("3. VISUAL DIRECTION"),
      out.indexOf("4. PRODUCT CONTEXT"),
      out.indexOf("5. CONVERSATION CONTEXT"),
    ];
    expect(order.every((i) => i >= 0), `all 5 sections present: ${order.join(",")}`).toBe(true);
    // Strictly increasing → in-order
    for (let i = 1; i < order.length; i++) {
      expect(order[i]).toBeGreaterThan(order[i - 1]);
    }
  });

  it("OMITS section 4 when brief is null (graceful degradation)", () => {
    const out = buildPrototypeBrief(
      fakeSession(),
      null,
      baseHistory,
      "Lead",
      "Lead reply",
      fakePack(),
    );

    expect(out).not.toContain("4. PRODUCT CONTEXT");
    // Sections 1/2/3/5 still present
    expect(out).toContain("1. MASTER INSTRUCTION");
    expect(out).toContain("2. WHAT TO BUILD");
    expect(out).toContain("3. VISUAL DIRECTION");
    expect(out).toContain("5. CONVERSATION CONTEXT");
  });

  it("adds the web_landing exception line ONLY for that project type", () => {
    const landing = buildPrototypeBrief(
      fakeSession({ projectType: "web_landing" }),
      null,
      baseHistory,
      "Lead",
      "Lead reply",
      fakePack(),
    );
    expect(landing).toContain("EXCEPTION: This project IS a landing page");

    const nonLanding = buildPrototypeBrief(
      fakeSession({ projectType: "webapp_system" }),
      null,
      baseHistory,
      "Lead",
      "Lead reply",
      fakePack(),
    );
    expect(nonLanding).not.toContain("EXCEPTION:");
  });

  it("formats refs with v0Hint as 'N. url — hint' and without as 'N. url'", () => {
    const out = buildPrototypeBrief(
      fakeSession(),
      null,
      baseHistory,
      "Lead",
      "Lead reply",
      fakePack(),
    );

    expect(out).toContain("1. robinhood.com — Investing consumer / dark bold");
    expect(out).toContain("2. wise.com\n"); // no hint → no " — " separator
    expect(out).toContain("3. coinbase.com — Cripto exchange / blue clean");
  });

  it("includes the style family name and feel string", () => {
    const out = buildPrototypeBrief(
      fakeSession(),
      null,
      baseHistory,
      "Lead",
      "Lead reply",
      fakePack(),
    );
    expect(out).toContain("Style family: Finance & Fintech");
    expect(out).toContain("Feel: Consumer investing");
  });

  it("falls back to initialPrompt when goalSummary is null", () => {
    const out = buildPrototypeBrief(
      fakeSession({ goalSummary: null, initialPrompt: "raw initial prompt" }),
      null,
      baseHistory,
      "Lead",
      "Lead reply",
      fakePack(),
    );
    expect(out).toContain("raw initial prompt");
  });

  it("filters thinking / system_event / error messages from conversation context", () => {
    const noisy: HistoryMessage[] = [
      { role: "assistant", content: "thinking…", type: "thinking" },
      { role: "user", content: "real user message" },
      { role: "assistant", content: "system event", type: "system_event" },
      { role: "assistant", content: "error banner", type: "error" },
    ];
    const out = buildPrototypeBrief(
      fakeSession(),
      null,
      noisy,
      "Latest user",
      "Latest assistant",
      fakePack(),
    );

    expect(out).toContain("real user message");
    expect(out).not.toContain("thinking…");
    expect(out).not.toContain("system event");
    expect(out).not.toContain("error banner");
  });

  it("collapses internal whitespace and trims to 300 chars per message", () => {
    const big = "x".repeat(500);
    const out = buildPrototypeBrief(
      fakeSession(),
      null,
      [{ role: "user", content: `multi\n\n  line   message ${big}` }],
      "Latest user",
      "Latest assistant",
      fakePack(),
    );

    // The huge "x" run should be truncated; only ~300 chars of it survive.
    const matches = out.match(/x+/g) ?? [];
    const longestX = Math.max(...matches.map((m) => m.length), 0);
    expect(longestX).toBeLessThanOrEqual(300);
  });

  it("skips brief fields that are null (only renders the present ones)", () => {
    const out = buildPrototypeBrief(
      fakeSession(),
      fakeBrief({
        users: null,
        coreFlow: null,
        platform: null,
        styleDirection: null,
      }),
      baseHistory,
      "Lead",
      "Lead reply",
      fakePack(),
    );

    expect(out).toContain("Objective: Reduce onboarding drop-off");
    expect(out).toContain("Primary user: First-time investor");
    expect(out).not.toContain("Users:");
    expect(out).not.toContain("Core flow:");
    expect(out).not.toContain("Platform:");
    expect(out).not.toContain("Style notes:");
  });
});

describe("buildCorrectionBrief", () => {
  it("passes through the raw prompt unchanged when no style pack", () => {
    const raw = "Make the hero darker and remove the second CTA.";
    expect(buildCorrectionBrief(raw)).toBe(raw);
  });

  it("appends visual direction block when a style pack is provided", () => {
    const out = buildCorrectionBrief("Make the hero darker.", fakePack());
    expect(out).toContain("Make the hero darker.");
    expect(out).toContain("[Visual direction — maintain this]");
    expect(out).toContain("Style family: Finance & Fintech");
    expect(out).toContain("References: robinhood.com, wise.com, coinbase.com");
  });

  it("orders the appendix AFTER the user prompt (preserves user's intent first)", () => {
    const out = buildCorrectionBrief("USER_PROMPT_HERE", fakePack());
    expect(out.indexOf("USER_PROMPT_HERE")).toBeLessThan(out.indexOf("[Visual direction"));
  });
});
