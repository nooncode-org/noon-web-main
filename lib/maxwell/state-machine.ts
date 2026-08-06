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
  // awaiting_direction = Fase A card pause (brain flag on): study done, the
  // client confirms the visual direction before anything generates.
  clarifying: ["generating_prototype", "awaiting_direction"],
  // → generating on the client's tap; → clarifying when the client steps
  // back into conversation (e.g. "usa mi referencia") or the card can't be
  // served (Regla 0 degrades to the direct path).
  awaiting_direction: ["generating_prototype", "clarifying"],
  generating_prototype: ["prototype_ready", "clarifying"],       // clarifying = v0 failure fallback
  // Sharing became an ATTRIBUTE (the share columns) on 2026-07-14 — nothing
  // transitions INTO `prototype_shared` anymore. The status itself stays in
  // the enum with its outgoing transitions so legacy rows persisted before
  // the change remain operable (they self-heal by adjusting or approving).
  prototype_ready: ["revision_requested", "approved_for_proposal"],
  revision_requested: ["revision_applied", "prototype_ready"],   // prototype_ready = correction failure fallback
  revision_applied: ["prototype_ready"],
  prototype_shared: ["revision_requested", "approved_for_proposal"],
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
    // The card is a decision, not a lock — the client can keep talking
    // ("usa mi referencia", "prefiero otra") while the direction waits.
    status === "awaiting_direction" ||
    status === "prototype_ready" ||
    status === "prototype_shared" ||
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
