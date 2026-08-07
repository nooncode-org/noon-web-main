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
 *   - The landing exception line shows up ONLY for that project type.
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
    projectType: "webapp",
    goalSummary: "Onboarding flow for crypto users",
    complexityHint: "medium",
    language: "en",
    correctionsUsed: 0,
    maxCorrections: 3,
    proposalRequestedAt: null,
    createdAt: "2026-05-17T00:00:00Z",
    updatedAt: "2026-05-17T00:00:00Z",
    stylePackId: null,
    direction: null,
    prototypeWorkspaceId: null,
    shareToken: null,
    shareTokenUrl: null,
    prototypeSharedAt: null,
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
    token: {
      palette: { bg: "#FFFFFF", ink: "#0B1220", accent: "#0052FF" },
      fonts: { display: "Inter", body: "Inter" },
      imagery: "architectural glass, city daylight",
    },
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

  it("adds the landing exception line ONLY for that project type", () => {
    const landing = buildPrototypeBrief(
      fakeSession({ projectType: "landing" }),
      null,
      baseHistory,
      "Lead",
      "Lead reply",
      fakePack(),
    );
    expect(landing).toContain("EXCEPTION: This project IS a landing page");

    const nonLanding = buildPrototypeBrief(
      fakeSession({ projectType: "webapp" }),
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

describe("buildPrototypeBrief — Fase A extras (the brain path)", () => {
  const baseHistory: HistoryMessage[] = [
    { role: "user", content: "Una página para mi panadería." },
  ];

  function fakeExtras() {
    const ficha = {
      version: 1 as const,
      url: "https://www.poilane.com",
      analyzedAt: "2026-08-05T00:00:00Z",
      measured: {
        fonts: [{ family: "aktiv-grotesk", weights: [400, 500] }],
        textStyles: [
          {
            role: "h1",
            fontFamily: "aktiv-grotesk",
            fontSizePx: 85,
            fontWeight: 500,
            lineHeight: 0.95,
            letterSpacingPx: 0,
          },
        ],
        palette: [{ hex: "#3a312e", role: "text" as const, count: 523 }],
        containerWidthPx: 1440,
        sectionGapsPx: [0, 1],
        borderRadiiPx: [8],
        buttons: [
          {
            backgroundHex: "#3a312e",
            textHex: "#ffffff",
            borderRadiusPx: 50,
            paddingPx: "12 24",
            fontSizePx: 14,
          },
        ],
      },
      judged: {
        sections: [
          { label: "section.hero", purpose: "sell bread at a glance", pattern: "full-bleed photo, left text" },
        ],
        hierarchy: "h1 85px/500 vs body 24px/400",
        composition: "single column 1440px",
        uxPatterns: [],
        ctas: [],
        imagery: [{ subject: "bread close-ups", treatment: "warm, 4:3" }],
        motion: [],
        responsive: "h1 drops to 40px",
        whyItWorks: ["one brown #3a312e carries the brand"],
        heroRecipe: "photo full-bleed, headline 85px overlaid",
      },
    };
    const order = {
      version: 1 as const,
      shotList: [],
      copy: {
        headline: "Pan de masa madre, cada mañana",
        subheadline: "Recogida o entrega",
        primaryCta: "Pedir por WhatsApp",
        secondaryCta: "",
        sections: [{ name: "Nuestro pan", purpose: "show the range", body: "Cinco panes diarios." }],
      },
      data: [{ label: "Hogaza", value: "$4.50" }],
      language: "es",
    };
    const verifiedSlots = [
      {
        slot: {
          slotId: "hero",
          role: "hero" as const,
          subject: "sourdough loaves",
          composition: "front",
          context: "bakery",
          light: "soft",
          perspective: "eye",
          feeling: "warmth",
          searchQuery: "sourdough bakery",
          geometry: { ratio: "16:9", minWidthPx: 1600, focalPoint: "center" },
        },
        image: {
          url: "https://cdn.example/hero.jpg",
          urlLarge: "https://cdn.example/hero@2x.jpg",
          alt: "sourdough loaves on wood",
          avgColor: "#8a6f4d",
        },
        verdict: "verified" as const,
      },
      {
        slot: {
          slotId: "portrait-1",
          role: "portrait" as const,
          subject: "baker portrait",
          composition: "bust",
          context: "bakery",
          light: "window",
          perspective: "eye",
          feeling: "trust",
          searchQuery: "baker portrait",
          geometry: { ratio: "1:1", minWidthPx: 400, focalPoint: "face centered" },
        },
        image: null,
        verdict: "empty" as const,
      },
    ];
    return { referenceDossier: ficha, order, verifiedSlots };
  }

  it("ships ficha, slot imagery, fixed copy and negative rules — sections still 1→5", () => {
    const out = buildPrototypeBrief(
      fakeSession({ language: "es" }),
      fakeBrief(),
      baseHistory,
      "Genera el prototipo",
      "Voy.",
      fakePack(),
      null,
      fakeExtras(),
    );

    // The brain blocks, present and anchored.
    expect(out).toContain("PRIMARY REFERENCE — measured values");
    expect(out).toContain("h1 85px/500");
    expect(out).toContain("CUSTOMS-APPROVED, ONE PHOTO PER SLOT");
    expect(out).toContain("SLOT hero [hero, 16:9, focal center]: https://cdn.example/hero@2x.jpg");
    expect(out).toContain("NO APPROVED PHOTO");
    expect(out).toContain("COPY & DATA — FIXED CONTENT");
    expect(out).toContain("Headline: Pan de masa madre, cada mañana");
    expect(out).toContain("NEGATIVE RULES — ANTI-SLOP");
    expect(out).toContain("Merit doctrine");

    // The pinned 1-5 contract survives the new blocks.
    const order = [
      out.indexOf("1. MASTER INSTRUCTION"),
      out.indexOf("2. WHAT TO BUILD"),
      out.indexOf("3. VISUAL DIRECTION"),
      out.indexOf("4. PRODUCT CONTEXT"),
      out.indexOf("5. CONVERSATION CONTEXT"),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    for (let i = 1; i < order.length; i++) {
      expect(order[i]).toBeGreaterThan(order[i - 1]);
    }
  });

  it("without extras the brief carries NONE of the brain blocks (emergency net intact)", () => {
    const out = buildPrototypeBrief(
      fakeSession(),
      null,
      baseHistory,
      "Lead",
      "Lead reply",
      fakePack(),
    );
    expect(out).not.toContain("PRIMARY REFERENCE");
    expect(out).not.toContain("CUSTOMS-APPROVED");
    expect(out).not.toContain("FIXED CONTENT");
    expect(out).not.toContain("NEGATIVE RULES");
  });

  it("trim ladder cuts the expendable, never the passport", () => {
    // A pathological extractor brief pushes the draft over budget; the
    // ladder must drop PRODUCT CONTEXT while copy, slots and palette stay.
    const out = buildPrototypeBrief(
      fakeSession({ language: "es" }),
      fakeBrief({ styleDirection: "y".repeat(20_000) }),
      baseHistory,
      "Genera",
      "Voy.",
      fakePack(),
      null,
      fakeExtras(),
    );

    expect(out.length).toBeLessThanOrEqual(15_000);
    expect(out).not.toContain("4. PRODUCT CONTEXT");
    // The passport survives the deepest trim.
    expect(out).toContain("Headline: Pan de masa madre, cada mañana");
    expect(out).toContain("SLOT hero");
    expect(out).toContain("Palette (dominance order): text:#3a312e");
    expect(out).toContain("NEGATIVE RULES — ANTI-SLOP");
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

describe("buildPrototypeBrief — the client's own reference (E2.4)", () => {
  const reading = {
    understood: "Buscas tonos cálidos y un aire artesanal.",
    palette: ["#8a6f4d", "#f3ece2"],
    styleNotes: ["madera clara", "luz lateral"],
    notCovered: ["estructura de secciones"],
    usable: true,
  };

  it("outranks the family and says what it does NOT cover", () => {
    const out = buildPrototypeBrief(
      fakeSession({ language: "es" }),
      null,
      [{ role: "user", content: "mi panadería" }],
      "Genera",
      "Voy.",
      fakePack(),
      null,
      { clientReading: reading },
    );

    expect(out).toContain("CLIENT'S OWN REFERENCE");
    expect(out).toContain("OUTRANKS every value above");
    expect(out).toContain("Buscas tonos cálidos");
    expect(out).toContain("#8a6f4d · #f3ece2");
    expect(out).toContain("does not cover: estructura de secciones");
    expect(out).toContain("never invent something the client did not ask for");

    // Their direction gets the LAST word of the visual direction — after
    // the family's values and after any pool ficha.
    expect(out.indexOf("CLIENT'S OWN REFERENCE")).toBeGreaterThan(
      out.indexOf("References (adapt the aesthetic"),
    );
    // And it turns the anti-slop rules on, like any brain path.
    expect(out).toContain("NEGATIVE RULES — ANTI-SLOP");
  });

  it("is absent when the client brought no reference", () => {
    const out = buildPrototypeBrief(
      fakeSession(),
      null,
      [{ role: "user", content: "x" }],
      "Lead",
      "Reply",
      fakePack(),
    );
    expect(out).not.toContain("CLIENT'S OWN REFERENCE");
  });
});

describe("buildCorrectionBrief — the blueprints travel (E3.1)", () => {
  const reading = {
    understood: "Buscas tonos cálidos y un aire artesanal.",
    palette: ["#8a6f4d"],
    styleNotes: ["madera clara"],
    notCovered: [],
    usable: true,
  };

  it("carries the client's direction and forbids a new style for new content", () => {
    const out = buildCorrectionBrief("Añade testimonios", fakePack(), {
      clientReading: reading,
    });

    expect(out.indexOf("Añade testimonios")).toBe(0);
    expect(out).toContain("CLIENT'S OWN REFERENCE");
    expect(out).toContain("Buscas tonos cálidos");
    expect(out).toContain("Never introduce a new style for new content");
    expect(out).toContain("never fill new sections with placeholder people");
  });

  it("works with only the family (no brain data) exactly as before", () => {
    const out = buildCorrectionBrief("Hazlo más oscuro", fakePack());

    expect(out).toContain("Style family: Finance & Fintech");
    expect(out).not.toContain("CLIENT'S OWN REFERENCE");
    expect(out).not.toContain("Never introduce a new style");
  });

  it("still passes the raw prompt through when there is nothing to maintain", () => {
    expect(buildCorrectionBrief("Solo cambia el título")).toBe("Solo cambia el título");
    expect(buildCorrectionBrief("Solo cambia el título", undefined, {})).toBe(
      "Solo cambia el título",
    );
  });
});
