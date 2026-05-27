/**
 * lib/maxwell/studio-guards.ts
 * Guardas de negocio para Maxwell Studio.
 * Cada guarda lanza MaxwellGuardError si la condición no se cumple.
 */

import type { StudioSession, StudioStatus, ClientWorkspace } from "./repositories";

// ============================================================================
// Error type
// ============================================================================

export class MaxwellGuardError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "MaxwellGuardError";
  }
}

// ============================================================================
// Corrections guard
// ============================================================================

/** Returns true if the session can still receive a correction. */
export function canRequestCorrection(session: StudioSession): boolean {
  return session.correctionsUsed < session.maxCorrections;
}

/**
 * Throws MaxwellGuardError if the session has exhausted all corrections.
 * This is a hard guard — no bypass permitted without agent intervention.
 */
export function assertCanRequestCorrection(session: StudioSession): void {
  if (!canRequestCorrection(session)) {
    throw new MaxwellGuardError(
      "MAX_CORRECTIONS_REACHED",
      `All ${session.maxCorrections} adjustments have been used. ` +
        "Approve the prototype, request a proposal, or talk to an agent to continue."
    );
  }
}

// ============================================================================
// Proposal guard
// ============================================================================

/**
 * Throws MaxwellGuardError if the session is not in a state that allows
 * requesting a proposal.
 *
 * Allowed sources:
 * - "approved_for_proposal"  → normal path (client approved explicitly)
 * - "prototype_ready"        → skip-to-proposal shortcut (auto-approves)
 * - "prototype_shared"       → seller shared prototipo with the client and now
 *                              wants to fall through to the legacy detailed-
 *                              proposal path (ADR-028 D7 / D12 ADDITIVE
 *                              coexistence). The proposal route auto-bridges
 *                              `prototype_shared → approved_for_proposal`
 *                              before transitioning to `proposal_pending_review`.
 */
export function assertCanRequestProposal(session: StudioSession): void {
  const allowed: StudioStatus[] = [
    "approved_for_proposal",
    "prototype_ready",
    "prototype_shared",
  ];
  if (!allowed.includes(session.status)) {
    throw new MaxwellGuardError(
      "PROPOSAL_NOT_ALLOWED",
      `Cannot request a proposal from status "${session.status}". ` +
        "The prototype must be ready or approved first."
    );
  }
}

// ============================================================================
// Proposal edit guard
// ============================================================================

/**
 * Throws MaxwellGuardError if the proposal has already been sent.
 * Sent proposals cannot be edited — changes create a new commercial version.
 */
export function assertProposalNotSent(proposalStatus: string): void {
  const lockedStatuses = new Set([
    "sent",
    "payment_pending",
    "payment_under_verification",
    "paid",
    "expired",
  ]);

  if (lockedStatuses.has(proposalStatus)) {
    throw new MaxwellGuardError(
      "PROPOSAL_ALREADY_SENT",
      "This proposal has already been sent. To make changes, a new commercial version must be created."
    );
  }
}

// ============================================================================
// Workspace guard
// ============================================================================

/**
 * Throws MaxwellGuardError if payment is not confirmed.
 * client_workspace must never be active without confirmed payment.
 */
export function assertPaymentConfirmed(paymentStatus: string): void {
  if (paymentStatus !== "confirmed") {
    throw new MaxwellGuardError(
      "PAYMENT_NOT_CONFIRMED",
      "The workspace cannot be activated until payment is confirmed."
    );
  }
}

/**
 * Throws MaxwellGuardError if the session is pre-payment.
 * Pre-payment sessions must never be represented as active workspaces.
 */
export function assertSessionIsConverted(session: StudioSession): void {
  if (session.status !== "converted") {
    throw new MaxwellGuardError(
      "SESSION_NOT_CONVERTED",
      "A workspace can only be created for a converted (paid) session."
    );
  }
}

/**
 * Throws MaxwellGuardError if a workspace already exists.
 * Prevents duplicate activation from retries once the workspace lifecycle exists.
 */
export function assertWorkspaceNotProvisioned(workspace: ClientWorkspace | null): void {
  if (workspace) {
    throw new MaxwellGuardError(
      "WORKSPACE_ALREADY_ACTIVE",
      "A workspace for this session already exists. Duplicate activation is not allowed."
    );
  }
}

/**
 * Backward-compatible alias kept while tests and callers migrate to the clearer name.
 */
export const assertWorkspaceNotActive = assertWorkspaceNotProvisioned;

/**
 * Throws MaxwellGuardError if the session is not in proposal_sent status.
 * Payment confirmation is only valid after the proposal has been formally sent.
 */
export function assertSessionAwaitingPayment(session: StudioSession): void {
  if (session.status !== "proposal_sent") {
    throw new MaxwellGuardError(
      "SESSION_NOT_AWAITING_PAYMENT",
      `Payment confirmation is not valid for status "${session.status}". ` +
        "The proposal must be sent before payment can be confirmed."
    );
  }
}
