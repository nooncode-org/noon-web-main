import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  assertValidTransition,
  InvalidTransitionError,
  canReceiveMessage,
  isTerminal,
  isGenerating,
} from "@/lib/maxwell/state-machine";
import type { StudioStatus } from "@/lib/maxwell/repositories";

// ============================================================================
// isValidTransition
// ============================================================================

describe("isValidTransition", () => {
  it("allows intake → clarifying", () => {
    expect(isValidTransition("intake", "clarifying")).toBe(true);
  });

  it("allows clarifying → generating_prototype", () => {
    expect(isValidTransition("clarifying", "generating_prototype")).toBe(true);
  });

  it("allows generating_prototype → prototype_ready", () => {
    expect(isValidTransition("generating_prototype", "prototype_ready")).toBe(true);
  });

  it("allows generating_prototype → clarifying (v0 failure fallback)", () => {
    expect(isValidTransition("generating_prototype", "clarifying")).toBe(true);
  });

  it("allows prototype_ready → revision_requested", () => {
    expect(isValidTransition("prototype_ready", "revision_requested")).toBe(true);
  });

  it("allows prototype_ready → approved_for_proposal", () => {
    expect(isValidTransition("prototype_ready", "approved_for_proposal")).toBe(true);
  });

  // Share became an ATTRIBUTE (2026-07-14): nothing transitions INTO
  // prototype_shared anymore, but legacy rows keep their outgoing paths.
  it("blocks prototype_ready → prototype_shared (share is an attribute now)", () => {
    expect(isValidTransition("prototype_ready", "prototype_shared")).toBe(false);
  });

  it("allows prototype_shared → revision_requested (legacy rows self-heal)", () => {
    expect(isValidTransition("prototype_shared", "revision_requested")).toBe(true);
  });

  it("allows prototype_shared → approved_for_proposal (legacy fallthrough)", () => {
    expect(isValidTransition("prototype_shared", "approved_for_proposal")).toBe(true);
  });

  it("blocks prototype_shared → prototype_ready (no silent status revert)", () => {
    // Legacy rows escape via revision_requested or approved_for_proposal;
    // the rehydrate view remaps their RENDERED phase without a DB write.
    expect(isValidTransition("prototype_shared", "prototype_ready")).toBe(false);
  });

  it("blocks prototype_shared → proposal_sent (skip approved)", () => {
    expect(isValidTransition("prototype_shared", "proposal_sent")).toBe(false);
  });

  it("allows revision_requested → prototype_ready (correction failure fallback)", () => {
    expect(isValidTransition("revision_requested", "prototype_ready")).toBe(true);
  });

  it("allows revision_applied → prototype_ready", () => {
    expect(isValidTransition("revision_applied", "prototype_ready")).toBe(true);
  });

  it("allows approved_for_proposal → proposal_pending_review", () => {
    expect(isValidTransition("approved_for_proposal", "proposal_pending_review")).toBe(true);
  });

  it("allows proposal_pending_review → proposal_sent", () => {
    expect(isValidTransition("proposal_pending_review", "proposal_sent")).toBe(true);
  });

  it("allows proposal_pending_review → approved_for_proposal (PM returned)", () => {
    expect(isValidTransition("proposal_pending_review", "approved_for_proposal")).toBe(true);
  });

  it("allows proposal_sent → converted", () => {
    expect(isValidTransition("proposal_sent", "converted")).toBe(true);
  });

  it("blocks intake → converted (skip)", () => {
    expect(isValidTransition("intake", "converted")).toBe(false);
  });

  it("blocks prototype_ready → proposal_sent (skip approved)", () => {
    expect(isValidTransition("prototype_ready", "proposal_sent")).toBe(false);
  });

  it("blocks converted → anything (terminal)", () => {
    const allStatuses: StudioStatus[] = [
      "intake", "clarifying", "generating_prototype", "prototype_ready",
      "revision_requested", "revision_applied", "prototype_shared",
      "approved_for_proposal", "proposal_pending_review", "proposal_sent",
      "converted",
    ];
    for (const s of allStatuses) {
      expect(isValidTransition("converted", s)).toBe(false);
    }
  });

  it("blocks proposal_sent → prototype_ready (backward)", () => {
    expect(isValidTransition("proposal_sent", "prototype_ready")).toBe(false);
  });
});

// ============================================================================
// assertValidTransition
// ============================================================================

describe("assertValidTransition", () => {
  it("does not throw for valid transitions", () => {
    expect(() => assertValidTransition("intake", "clarifying")).not.toThrow();
    expect(() => assertValidTransition("prototype_ready", "revision_requested")).not.toThrow();
  });

  it("throws InvalidTransitionError for invalid transitions", () => {
    expect(() => assertValidTransition("intake", "converted")).toThrow(InvalidTransitionError);
    expect(() => assertValidTransition("converted", "intake")).toThrow(InvalidTransitionError);
  });

  it("error message includes from and to states", () => {
    expect(() => assertValidTransition("intake", "proposal_sent")).toThrow(
      "intake → proposal_sent"
    );
  });
});

// ============================================================================
// Convenience helpers
// ============================================================================

describe("canReceiveMessage", () => {
  it("returns true for message-accepting states", () => {
    expect(canReceiveMessage("intake")).toBe(true);
    expect(canReceiveMessage("clarifying")).toBe(true);
    expect(canReceiveMessage("prototype_ready")).toBe(true);
    expect(canReceiveMessage("prototype_shared")).toBe(true);
    expect(canReceiveMessage("approved_for_proposal")).toBe(true);
  });

  it("returns false for non-message states", () => {
    expect(canReceiveMessage("generating_prototype")).toBe(false);
    expect(canReceiveMessage("revision_requested")).toBe(false);
    expect(canReceiveMessage("proposal_pending_review")).toBe(true);
    expect(canReceiveMessage("proposal_sent")).toBe(true);
    expect(canReceiveMessage("converted")).toBe(false);
  });
});

describe("isTerminal", () => {
  it("returns true only for converted", () => {
    expect(isTerminal("converted")).toBe(true);
  });

  it("returns false for all other states", () => {
    expect(isTerminal("intake")).toBe(false);
    expect(isTerminal("proposal_sent")).toBe(false);
  });
});

describe("isGenerating", () => {
  it("returns true during prototype generation and correction", () => {
    expect(isGenerating("generating_prototype")).toBe(true);
    expect(isGenerating("revision_requested")).toBe(true);
  });

  it("returns false for all other states", () => {
    expect(isGenerating("prototype_ready")).toBe(false);
    expect(isGenerating("clarifying")).toBe(false);
  });
});
