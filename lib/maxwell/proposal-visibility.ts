import type { ProposalStatus } from "./repositories";

/**
 * lib/maxwell/proposal-visibility.ts
 *
 * Single source of truth for "which proposal statuses render on the public
 * proposal page" (`/maxwell/proposal/[token]`).
 *
 * Two callers depend on this staying in sync:
 *   1. The public page itself — serves the proposal for these statuses, else
 *      404s the token (indistinguishable from an unknown token; see B19).
 *   2. The Studio session route (`/api/maxwell/studio/session`) — only hands the
 *      session owner the `publicToken` for these statuses, so the Studio
 *      "View your proposal" CTA never deep-links to a token the public page
 *      would reject (draft / pending_review / under_review / approved / etc.).
 *
 * Keeping the list here (not duplicated per caller) means adding a status is a
 * one-line change that both honour automatically.
 */
export const PUBLIC_PROPOSAL_STATUSES = new Set<ProposalStatus>([
  "sent",
  "payment_pending",
  "payment_under_verification",
  "paid",
  "expired",
]);

/**
 * True when the public proposal page renders a real view for `status` (and thus
 * when it is safe to surface the proposal's public token to its owner).
 */
export function isProposalPubliclyViewable(
  status: ProposalStatus | null | undefined,
): boolean {
  return status != null && PUBLIC_PROPOSAL_STATUSES.has(status);
}
