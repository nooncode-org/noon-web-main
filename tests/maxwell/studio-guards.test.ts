import { describe, it, expect } from "vitest";
import {
  MaxwellGuardError,
  canRequestCorrection,
  assertCanRequestCorrection,
  assertCanRequestProposal,
  assertProposalNotSent,
  assertPaymentConfirmed,
  assertSessionIsConverted,
  assertWorkspaceNotProvisioned,
  assertSessionAwaitingPayment,
} from "@/lib/maxwell/studio-guards";
import type { StudioSession, ClientWorkspace } from "@/lib/maxwell/repositories";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<StudioSession> = {}): StudioSession {
  return {
    id: "sess-1",
    initialPrompt: "test prompt",
    status: "prototype_ready",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    ownerImage: null,
    projectType: null,
    goalSummary: null,
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

function makeWorkspace(overrides: Partial<ClientWorkspace> = {}): ClientWorkspace {
  return {
    id: "ws-1",
    studioSessionId: "sess-1",
    paymentStatus: "pending",
    workspaceStatus: "in_preparation",
    latestUpdateSummary: null,
    noonAppProjectId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// MaxwellGuardError
// ============================================================================

describe("MaxwellGuardError", () => {
  it("sets code and message correctly", () => {
    const err = new MaxwellGuardError("SOME_CODE", "some message");
    expect(err.code).toBe("SOME_CODE");
    expect(err.message).toBe("some message");
    expect(err.name).toBe("MaxwellGuardError");
    expect(err).toBeInstanceOf(Error);
  });
});

// ============================================================================
// Corrections guard — QA matrix: rows 3, 4, 5
// ============================================================================

describe("canRequestCorrection", () => {
  it("returns true when corrections not exhausted (0/2)", () => {
    expect(canRequestCorrection(makeSession({ correctionsUsed: 0, maxCorrections: 2 }))).toBe(true);
  });

  it("returns true when 1 of 2 corrections used", () => {
    expect(canRequestCorrection(makeSession({ correctionsUsed: 1, maxCorrections: 2 }))).toBe(true);
  });

  it("returns false when all corrections used (2/2)", () => {
    expect(canRequestCorrection(makeSession({ correctionsUsed: 2, maxCorrections: 2 }))).toBe(false);
  });

  it("returns false when corrections exceed max (guard bypass attempt)", () => {
    expect(canRequestCorrection(makeSession({ correctionsUsed: 3, maxCorrections: 2 }))).toBe(false);
  });
});

describe("assertCanRequestCorrection", () => {
  it("does not throw when corrections available", () => {
    expect(() =>
      assertCanRequestCorrection(makeSession({ correctionsUsed: 1, maxCorrections: 2 }))
    ).not.toThrow();
  });

  // QA matrix row 5: "Intento de tercera corrección — Sistema bloquea"
  it("throws MAX_CORRECTIONS_REACHED when all used (2/2)", () => {
    const session = makeSession({ correctionsUsed: 2, maxCorrections: 2 });
    expect(() => assertCanRequestCorrection(session)).toThrow(MaxwellGuardError);
    try {
      assertCanRequestCorrection(session);
    } catch (e) {
      expect((e as MaxwellGuardError).code).toBe("MAX_CORRECTIONS_REACHED");
    }
  });

  it("error includes max_corrections count", () => {
    const session = makeSession({ correctionsUsed: 2, maxCorrections: 2 });
    expect(() => assertCanRequestCorrection(session)).toThrow("2 adjustments");
  });
});

// ============================================================================
// Proposal guard
// ============================================================================

describe("assertCanRequestProposal", () => {
  it("allows from approved_for_proposal (normal path)", () => {
    expect(() =>
      assertCanRequestProposal(makeSession({ status: "approved_for_proposal" }))
    ).not.toThrow();
  });

  it("allows from prototype_ready (skip-to-proposal)", () => {
    expect(() =>
      assertCanRequestProposal(makeSession({ status: "prototype_ready" }))
    ).not.toThrow();
  });

  it("throws PROPOSAL_NOT_ALLOWED from intake", () => {
    const session = makeSession({ status: "intake" });
    expect(() => assertCanRequestProposal(session)).toThrow(MaxwellGuardError);
    try {
      assertCanRequestProposal(session);
    } catch (e) {
      expect((e as MaxwellGuardError).code).toBe("PROPOSAL_NOT_ALLOWED");
    }
  });

  it("throws PROPOSAL_NOT_ALLOWED from clarifying", () => {
    expect(() =>
      assertCanRequestProposal(makeSession({ status: "clarifying" }))
    ).toThrow(MaxwellGuardError);
    try {
      assertCanRequestProposal(makeSession({ status: "clarifying" }));
    } catch (e) {
      expect((e as MaxwellGuardError).code).toBe("PROPOSAL_NOT_ALLOWED");
    }
  });

  it("throws PROPOSAL_NOT_ALLOWED from converted (already done)", () => {
    expect(() =>
      assertCanRequestProposal(makeSession({ status: "converted" }))
    ).toThrow(MaxwellGuardError);
  });
});

// ============================================================================
// Proposal sent guard
// ============================================================================

describe("assertProposalNotSent", () => {
  it("does not throw when proposal is pending_review", () => {
    expect(() => assertProposalNotSent("pending_review")).not.toThrow();
  });

  it("does not throw when proposal is under_review", () => {
    expect(() => assertProposalNotSent("under_review")).not.toThrow();
  });

  it("throws PROPOSAL_ALREADY_SENT when status is sent", () => {
    expect(() => assertProposalNotSent("sent")).toThrow(MaxwellGuardError);
    try {
      assertProposalNotSent("sent");
    } catch (e) {
      expect((e as MaxwellGuardError).code).toBe("PROPOSAL_ALREADY_SENT");
    }
  });

  it("throws PROPOSAL_ALREADY_SENT for post-send payment states", () => {
    expect(() => assertProposalNotSent("payment_pending")).toThrow(MaxwellGuardError);
    expect(() => assertProposalNotSent("payment_under_verification")).toThrow(MaxwellGuardError);
    expect(() => assertProposalNotSent("paid")).toThrow(MaxwellGuardError);
    expect(() => assertProposalNotSent("expired")).toThrow(MaxwellGuardError);
  });
});

// ============================================================================
// Payment + workspace guards — QA matrix rows 10, 11
// ============================================================================

describe("assertPaymentConfirmed", () => {
  // QA matrix row 10: "Pago no confirmado — No se crea client_workspace"
  it("does not throw for confirmed", () => {
    expect(() => assertPaymentConfirmed("confirmed")).not.toThrow();
  });

  it("throws PAYMENT_NOT_CONFIRMED for pending", () => {
    expect(() => assertPaymentConfirmed("pending")).toThrow(MaxwellGuardError);
    try {
      assertPaymentConfirmed("pending");
    } catch (e) {
      expect((e as MaxwellGuardError).code).toBe("PAYMENT_NOT_CONFIRMED");
    }
  });

  it("throws PAYMENT_NOT_CONFIRMED for failed", () => {
    expect(() => assertPaymentConfirmed("failed")).toThrow(MaxwellGuardError);
  });
});

describe("assertSessionIsConverted", () => {
  it("does not throw for converted sessions", () => {
    expect(() =>
      assertSessionIsConverted(makeSession({ status: "converted" }))
    ).not.toThrow();
  });

  it("throws SESSION_NOT_CONVERTED for proposal_sent", () => {
    expect(() =>
      assertSessionIsConverted(makeSession({ status: "proposal_sent" }))
    ).toThrow(MaxwellGuardError);
    try {
      assertSessionIsConverted(makeSession({ status: "proposal_sent" }));
    } catch (e) {
      expect((e as MaxwellGuardError).code).toBe("SESSION_NOT_CONVERTED");
    }
  });
});

describe("assertWorkspaceNotProvisioned", () => {
  it("does not throw when workspace is null", () => {
    expect(() => assertWorkspaceNotProvisioned(null)).not.toThrow();
  });

  it("throws when any workspace already exists", () => {
    expect(() =>
      assertWorkspaceNotProvisioned(makeWorkspace({ workspaceStatus: "in_preparation" }))
    ).toThrow(MaxwellGuardError);
    try {
      assertWorkspaceNotProvisioned(makeWorkspace({ workspaceStatus: "active" }));
    } catch (e) {
      expect((e as MaxwellGuardError).code).toBe("WORKSPACE_ALREADY_ACTIVE");
    }
  });
});

describe("assertSessionAwaitingPayment", () => {
  it("does not throw for proposal_sent", () => {
    expect(() =>
      assertSessionAwaitingPayment(makeSession({ status: "proposal_sent" }))
    ).not.toThrow();
  });

  it("throws SESSION_NOT_AWAITING_PAYMENT for converted", () => {
    expect(() =>
      assertSessionAwaitingPayment(makeSession({ status: "converted" }))
    ).toThrow(MaxwellGuardError);
    try {
      assertSessionAwaitingPayment(makeSession({ status: "converted" }));
    } catch (e) {
      expect((e as MaxwellGuardError).code).toBe("SESSION_NOT_AWAITING_PAYMENT");
    }
  });

  it("throws SESSION_NOT_AWAITING_PAYMENT for prototype_ready", () => {
    expect(() =>
      assertSessionAwaitingPayment(makeSession({ status: "prototype_ready" }))
    ).toThrow(MaxwellGuardError);
  });
});
