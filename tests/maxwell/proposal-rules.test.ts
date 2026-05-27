import { describe, it, expect } from "vitest";
import {
  resolveProjectCategory,
  resolveComplexityTier,
  formatPricing,
  validateProposalDraft,
  buildProposalContext,
  isMembershipContraindicated,
  PRICING_TABLE,
} from "@/lib/maxwell/proposal-rules";
import type { StudioSession, StudioVersion } from "@/lib/maxwell/repositories";

function makeSession(overrides: Partial<StudioSession> = {}): StudioSession {
  return {
    id: "sess-1",
    initialPrompt: "Build a booking platform for yoga studios",
    status: "approved_for_proposal",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    ownerImage: null,
    projectType: null,
    goalSummary: "Yoga studio booking system",
    complexityHint: null,
    language: "en",
    correctionsUsed: 1,
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

function makeVersion(n: number, source: "initial" | "correction" = "initial"): StudioVersion {
  return {
    id: `ver-${n}`,
    studioSessionId: "sess-1",
    versionNumber: n,
    previewUrl: `https://v0.dev/chat/abc${n}`,
    v0ChatId: `chat-${n}`,
    changeSummary: source === "correction" ? `Change #${n}` : null,
    source,
    createdAt: new Date().toISOString(),
  };
}

describe("resolveProjectCategory", () => {
  it("returns webapp for null (default)", () => {
    expect(resolveProjectCategory(null)).toBe("webapp");
  });

  it("resolves mobile hints first", () => {
    expect(resolveProjectCategory("mobile app")).toBe("mobile");
    expect(resolveProjectCategory("iOS app")).toBe("mobile");
    expect(resolveProjectCategory("app móvil")).toBe("mobile");
    expect(resolveProjectCategory("android app")).toBe("mobile");
  });

  it("resolves saas/ai/automation hints", () => {
    expect(resolveProjectCategory("AI assistant")).toBe("saas_ai");
    expect(resolveProjectCategory("chatbot automation")).toBe("saas_ai");
    expect(resolveProjectCategory("LLM integration")).toBe("saas_ai");
    expect(resolveProjectCategory("SaaS platform")).toBe("saas_ai");
  });

  it("resolves ecommerce hints", () => {
    expect(resolveProjectCategory("online store")).toBe("ecommerce");
    expect(resolveProjectCategory("tienda online")).toBe("ecommerce");
    expect(resolveProjectCategory("ecommerce shop")).toBe("ecommerce");
  });

  it("resolves simple web/landing hints", () => {
    expect(resolveProjectCategory("landing page")).toBe("landing");
    expect(resolveProjectCategory("corporate website")).toBe("landing");
    expect(resolveProjectCategory("portfolio site")).toBe("landing");
  });

  it("falls back to webapp for dashboards and systems", () => {
    expect(resolveProjectCategory("ERP system")).toBe("webapp");
    expect(resolveProjectCategory("operations dashboard")).toBe("webapp");
    expect(resolveProjectCategory("internal tool")).toBe("webapp");
  });
});

describe("resolveComplexityTier", () => {
  it("returns medio for null hint", () => {
    expect(resolveComplexityTier(null)).toBe("medio");
  });

  it("returns bajo for simple/basic/starter hints", () => {
    expect(resolveComplexityTier("simple")).toBe("bajo");
    expect(resolveComplexityTier("basic")).toBe("bajo");
    expect(resolveComplexityTier("starter project")).toBe("bajo");
    expect(resolveComplexityTier("pequeño")).toBe("bajo");
  });

  it("returns alto for complex/enterprise hints", () => {
    expect(resolveComplexityTier("complex system")).toBe("alto");
    expect(resolveComplexityTier("enterprise system")).toBe("alto");
    expect(resolveComplexityTier("high complexity")).toBe("alto");
    expect(resolveComplexityTier("alto")).toBe("alto");
    expect(resolveComplexityTier("advanced platform")).toBe("alto");
  });

  it("returns medio for unrecognized hints", () => {
    expect(resolveComplexityTier("some project")).toBe("medio");
  });
});

describe("formatPricing", () => {
  it("returns exact USD-formatted strings (no ranges)", () => {
    const result = formatPricing("webapp", "medio");
    expect(result.activation).toMatch(/^\$\d+ USD$/);
    expect(result.monthly).toMatch(/^\$\d+ USD\/mes$/);
  });

  it("bajo tier is cheaper than alto in every category", () => {
    const categories = [
      "landing",
      "ecommerce",
      "webapp",
      "mobile",
      "saas_ai",
    ] as const;

    for (const category of categories) {
      const bajo = PRICING_TABLE[category].bajo;
      const alto = PRICING_TABLE[category].alto;
      expect(bajo.activation).toBeLessThan(alto.activation);
      expect(bajo.monthly).toBeLessThan(alto.monthly);
    }
  });

  it("all cells have activation fee and monthly fee", () => {
    const categories = [
      "landing",
      "ecommerce",
      "webapp",
      "mobile",
      "saas_ai",
    ] as const;
    const tiers = ["bajo", "medio", "alto"] as const;

    for (const category of categories) {
      for (const tier of tiers) {
        const row = PRICING_TABLE[category][tier];
        expect(row.activation).toBeGreaterThan(0);
        expect(row.monthly).toBeGreaterThan(0);
      }
    }
  });
});

describe("isMembershipContraindicated", () => {
  it("returns false for null", () => {
    expect(isMembershipContraindicated(null)).toBe(false);
  });

  it("returns true for marketplace projects", () => {
    expect(isMembershipContraindicated("multi-vendor marketplace")).toBe(true);
    expect(isMembershipContraindicated("marketplace platform")).toBe(true);
  });

  it("returns true for blockchain/web3 projects", () => {
    expect(isMembershipContraindicated("blockchain solution")).toBe(true);
    expect(isMembershipContraindicated("web3 app")).toBe(true);
    expect(isMembershipContraindicated("smart contract")).toBe(true);
  });

  it("returns true for game development", () => {
    expect(isMembershipContraindicated("game development")).toBe(true);
    expect(isMembershipContraindicated("mobile gaming app")).toBe(true);
  });

  it("returns false for regular web app", () => {
    expect(isMembershipContraindicated("customer portal with subscription billing")).toBe(false);
  });
});

describe("validateProposalDraft", () => {
  it("returns no warnings for a clean draft with exact prices", () => {
    const clean = `
## Project Proposal - Yoga Studio Platform

**Executive Summary**
We will build a booking platform for yoga studios.

**Investment**
Pago unico: $179 USD

Membresia - Recomendado: $179 USD activacion + $69 USD/mes
Incluye hosting, base de datos basica, soporte, actualizaciones menores y avance gradual del proyecto.

Pago flexible (opcion secundaria): disponible solo mediante coordinacion con un agente de Noon para casos que requieran avance por etapas.
    `;
    expect(validateProposalDraft(clean)).toHaveLength(0);
  });

  it("flags discount percentage", () => {
    const draft = "If you pay upfront you get 10% off the total.";
    const warnings = validateProposalDraft(draft);
    expect(warnings.length).toBeGreaterThan(0);
    expect(
      warnings.some((warning) =>
        warning.toLowerCase().includes("descuento") || warning.toLowerCase().includes("discount")
      )
    ).toBe(true);
  });

  it("flags phase-based payment (English)", () => {
    const draft = "Phase 1 payment: $3,000. Phase 2 payment: $3,000.";
    const warnings = validateProposalDraft(draft);
    expect(warnings.some((warning) => warning.toLowerCase().includes("fase") || warning.toLowerCase().includes("phase"))).toBe(true);
  });

  it("flags pago por fases (Spanish)", () => {
    const draft = "Ofrecemos pago por fases adaptado a tu presupuesto.";
    const warnings = validateProposalDraft(draft);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("flags pago por etapas wording", () => {
    const draft = "Pago por etapas disponible con coordinacion del agente.";
    const warnings = validateProposalDraft(draft);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("flags installment plans", () => {
    const draft = "We offer installments to make the project more accessible.";
    const warnings = validateProposalDraft(draft);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("allows Pago flexible as a secondary agent-led option", () => {
    const draft = "Pago flexible: disponible solo mediante coordinacion con un agente de Noon.";
    const warnings = validateProposalDraft(draft);
    expect(warnings).toHaveLength(0);
  });

  it("flags drafts that omit the visible Pago flexible option", () => {
    const draft = `
      **Investment**
      Pago unico: $179 USD
      Membresia - Recomendado: $179 USD activacion + $69 USD/mes
    `;
    const warnings = validateProposalDraft(draft, { membershipRecommended: true });
    expect(warnings.some((warning) => warning.includes("Pago flexible"))).toBe(true);
  });

  it("flags drafts that omit membership when membership is recommended", () => {
    const draft = `
      **Investment**
      Pago unico: $179 USD
      Pago flexible (opcion secundaria): disponible solo mediante coordinacion con un agente de Noon.
    `;
    const warnings = validateProposalDraft(draft, { membershipRecommended: true });
    expect(warnings.some((warning) => warning.includes("Membresia"))).toBe(true);
  });

  it("flags technical delivery before payment", () => {
    const draft = "You will receive repository access upon signing.";
    const warnings = validateProposalDraft(draft);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("flags price ranges (desde / range)", () => {
    const draft = "Precio: desde $99 USD";
    const warnings = validateProposalDraft(draft);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("flags multiple issues in a single draft", () => {
    const draft = `
      You get 15% discount for full payment.
      Phase 1 payment covers the design phase.
      Repository access provided after signing.
    `;
    const warnings = validateProposalDraft(draft);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
});

describe("buildProposalContext", () => {
  it("includes session metadata", () => {
    const session = makeSession();
    const context = buildProposalContext(session, [], []);
    expect(context).toContain(session.initialPrompt);
    expect(context).toContain(session.goalSummary!);
    expect(context).toContain("Corrections used: 1");
  });

  it("includes resolved category and tier", () => {
    const context = buildProposalContext(
      makeSession({ projectType: "landing page", complexityHint: "simple" }),
      [],
      []
    );
    expect(context).toContain("Web básica / Landing / Corporate");
    expect(context).toContain("Bajo");
  });

  it("includes version history when versions are present", () => {
    const versions = [makeVersion(1), makeVersion(2, "correction")];
    const context = buildProposalContext(makeSession(), [], versions);
    expect(context).toContain("v1");
    expect(context).toContain("v2");
    expect(context).toContain("Change #2");
  });

  it("includes conversation messages", () => {
    const messages = [
      { role: "user" as const, content: "I want a booking platform" },
      { role: "assistant" as const, content: "Who are the primary users?" },
    ];
    const context = buildProposalContext(makeSession(), messages, []);
    expect(context).toContain("I want a booking platform");
    expect(context).toContain("Who are the primary users?");
  });

  it("includes exact price guidance", () => {
    const context = buildProposalContext(makeSession({ complexityHint: "simple" }), [], []);
    expect(context).toContain("Activation fee");
    expect(context).toContain("EXACT price");
    expect(context).toContain("Pago flexible");
  });

  it("notes membership not recommended for marketplace", () => {
    const context = buildProposalContext(
      makeSession({ initialPrompt: "Build a multi-vendor marketplace", projectType: "marketplace" }),
      [],
      []
    );
    expect(context).toContain("NOT recommended");
  });

  it("instructs writing in Spanish when language is es", () => {
    const context = buildProposalContext(makeSession({ language: "es" }), [], []);
    expect(context).toContain("Spanish");
  });

  it("instructs writing in English when language is en", () => {
    const context = buildProposalContext(makeSession({ language: "en" }), [], []);
    expect(context).toContain("English");
  });

  it("includes post-payment journey guidance", () => {
    const context = buildProposalContext(makeSession(), [], []);
    expect(context).toContain("under 20 minutes");
    expect(context).toContain("Latest Update");
    expect(context).toContain("In Preparation");
    expect(context).toContain("QA");
    expect(context).toContain("deployment");
  });
});
