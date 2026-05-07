/**
 * lib/maxwell/state-machine.ts
 * Transiciones válidas de estado para studio_session.
 */

import type { StudioStatus } from "./repositories";

// ============================================================================
// Transition table
// ============================================================================

/**
 * Maps current status → set of valid next statuses.
 * Any transition not in this table is illegal.
 */
const VALID_TRANSITIONS: Record<StudioStatus, StudioStatus[]> = {
  intake: ["clarifying"],
  clarifying: ["generating_prototype"],
  generating_prototype: ["prototype_ready", "clarifying"],       // clarifying = v0 failure fallback
  prototype_ready: ["revision_requested", "approved_for_proposal"],
  revision_requested: ["revision_applied", "prototype_ready"],   // prototype_ready = correction failure fallback
  revision_applied: ["prototype_ready"],
  approved_for_proposal: ["proposal_pending_review"],
  proposal_pending_review: ["proposal_sent", "approved_for_proposal"], // approved_for_proposal = PM returned
  proposal_sent: ["converted"],
  converted: [],
};

// ============================================================================
// Validation
// ============================================================================

export function isValidTransition(from: StudioStatus, to: StudioStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidTransitionError extends Error {
  constructor(from: StudioStatus, to: StudioStatus) {
    super(`Invalid transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertValidTransition(from: StudioStatus, to: StudioStatus): void {
  if (!isValidTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

// ============================================================================
// Convenience helpers
// ============================================================================

/** Returns true if the session can still receive free-form chat from the client. */
export function canReceiveMessage(status: StudioStatus): boolean {
  return (
    status === "intake" ||
    status === "clarifying" ||
    status === "prototype_ready" ||
    status === "approved_for_proposal" ||
    status === "proposal_pending_review" ||
    status === "proposal_sent"
  );
}

/** Returns true if the session is in a terminal or near-terminal state. */
export function isTerminal(status: StudioStatus): boolean {
  return status === "converted";
}

/** Returns true if a prototype generation is currently underway. */
export function isGenerating(status: StudioStatus): boolean {
  return status === "generating_prototype" || status === "revision_requested";
}
