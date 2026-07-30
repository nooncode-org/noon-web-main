/**
 * The "proposal sent for review" milestone: the facts, not the rendering.
 *
 * Kept out of the component so the decision of WHAT the card states can be
 * tested without mounting React, and so the bench and the live chat build the
 * same object instead of two hand-written approximations that drift.
 *
 * The rule this file enforces is that every row is something the client does not
 * already have in front of them, and nothing is invented to fill the shape out.
 * A row whose value is missing is omitted, not padded — see `buildProposalMilestone`.
 */

export type MilestoneRow = {
  label: string;
  value?: string | null;
  chips?: string[];
  /** Render the Noon brand tile as the row's avatar (the reviewer row). */
  noonAvatar?: boolean;
};

export type StudioMilestone = {
  /** ISO timestamp of the event itself, not of the render. */
  at?: string | null;
  /** Where it stands right now, in one line. */
  status?: string | null;
  rows?: MilestoneRow[];
  action?: { label: string; href: string } | null;
};

export const PROPOSAL_MILESTONE_TITLE = "Proposal sent for review";

export const PROPOSAL_MILESTONE_STATUS =
  "A Project Manager is verifying it. You'll get the formal version by email once it's approved.";

export type ProposalMilestoneInput = {
  /** `proposal_request.created_at`; the client's own clock when it just happened. */
  at: string | null;
  requestedBy: string | null;
  /** The session's goal summary — the project in the client's own words. */
  projectName: string | null;
  /** Version the proposal was drafted from; null before any prototype exists. */
  prototypeVersion: number | null;
  /**
   * Link to the proposal page. Null while it is still in review — the token is
   * only exposed for statuses the page actually renders, and a button leading to
   * a 404 is worse than no button. It appears on its own once the proposal is
   * sent and the client reloads.
   */
  proposalHref: string | null;
};

export function buildProposalMilestone(input: ProposalMilestoneInput): StudioMilestone {
  const rows: MilestoneRow[] = [];

  if (input.requestedBy) {
    rows.push({ label: "Requested by", value: input.requestedBy });
  }
  // Always present: this is the one fact the client cannot know on their own —
  // who is holding their proposal right now.
  rows.push({ label: "Reviewed by", value: "Noon team", noonAvatar: true });

  if (input.projectName?.trim()) {
    // Plain text, not a chip. The goal summary is a SENTENCE the client wrote;
    // chips are for short identifiers, and a paragraph inside a pill reads as a
    // mislabelled tag. "Built from" below is a real identifier, so it gets one.
    rows.push({ label: "Project", value: input.projectName.trim() });
  }
  if (typeof input.prototypeVersion === "number" && input.prototypeVersion > 0) {
    rows.push({ label: "Built from", chips: [`Prototype v${input.prototypeVersion}`] });
  }

  return {
    at: input.at,
    status: PROPOSAL_MILESTONE_STATUS,
    rows,
    action: input.proposalHref ? { label: "View proposal", href: input.proposalHref } : null,
  };
}
