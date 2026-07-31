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

export type MilestoneStep = {
  label: string;
  detail?: string | null;
  status: "done" | "active" | "pending";
};

export type StudioMilestone = {
  /** ISO timestamp of the event itself, not of the render. */
  at?: string | null;
  /** Where it stands right now, in one line. */
  status?: string | null;
  /** Live progress — present only while the thing is still happening. */
  steps?: MilestoneStep[];
  /**
   * A permanent fact about the event, not its current state. Deliberately NOT
   * `status`: that one was removed for going stale (a record cannot keep saying
   * "a PM is verifying it" forever). Anything put here has to stay true for as
   * long as the card exists.
   */
  note?: string | null;
  rows?: MilestoneRow[];
  action?: { label: string; href: string } | null;
};

/**
 * The three states the client actually goes through, and nothing else.
 *
 *   drafting → the POST is in flight: the server is writing the proposal from
 *              the conversation. Seconds.
 *   review   → the draft exists and sits with the Noon team. A PM has a
 *              PROPOSAL_REVIEW_AUTO_SEND_MINUTES window to intervene; if they
 *              don't, it goes out on its own. Minutes, not days.
 *   ready    → the status is one the public proposal page renders, so there is
 *              something to open and pay.
 *
 * Sourced from the proposal's real status — no timers pretending to be progress.
 */
export type ProposalStage = "drafting" | "review" | "ready";

export const PROPOSAL_STAGE_ORDER = ["drafting", "review", "ready"] as const;

/** Statuses the public proposal page renders — mirrors proposal-visibility. */
const READY_STATUSES = new Set([
  "sent",
  "payment_pending",
  "payment_under_verification",
  "paid",
  "expired",
]);

export function proposalStageFromStatus(status: string | null | undefined): ProposalStage {
  if (!status) return "drafting";
  return READY_STATUSES.has(status) ? "ready" : "review";
}

export function proposalStepStatus(
  step: ProposalStage,
  current: ProposalStage,
): "done" | "active" | "pending" {
  // Positional, with no high-water mark: the stage IS the truth, so a step can
  // never claim to be finished because it was finished a moment ago.
  const stepIndex = PROPOSAL_STAGE_ORDER.indexOf(step);
  const currentIndex = PROPOSAL_STAGE_ORDER.indexOf(current);
  if (stepIndex < currentIndex) return "done";
  return stepIndex === currentIndex ? "active" : "pending";
}

export function proposalStageLabel(step: ProposalStage): string {
  switch (step) {
    case "drafting":
      return "Writing your proposal";
    case "review":
      return "Final check by the Noon team";
    case "ready":
      return "Ready to review and pay";
  }
}

export function proposalStageDetail(step: ProposalStage): string | null {
  // Only where there is something true to add. The 15 minutes is a product
  // constant (PROPOSAL_REVIEW_AUTO_SEND_MINUTES), NOT this proposal's own
  // deadline — those timestamps are ops-internal and never leave the server.
  return step === "review" ? "Usually ready in about 15 minutes." : null;
}

/** The card's heading follows the stage: it must never outrun the facts. */
export function proposalMilestoneTitle(stage: ProposalStage): string {
  return stage === "ready" ? "Your proposal is ready" : "Preparing your proposal";
}

export type ProposalMilestoneInput = {
  /** Where the proposal actually is, from its status. */
  stage: ProposalStage;
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
    // No status line, deliberately. Seen inside the real chat, it repeated the
    // proposal-phase panel sitting directly beneath it — and worse, it GOES
    // STALE: this card is the record of an event at a point in time, rebuilt on
    // every reload, so once the PM sends the proposal it would still be telling
    // the client "a Project Manager is verifying it". Live state belongs to the
    // phase panel, which updates; the card states what happened and when.
    // (In the owner's reference the equivalent banner sits ABOVE the timeline,
    // not inside an entry — which is exactly where our panel already is.)
    //
    // While it is being prepared the card shows STEPS instead of facts: there is
    // nothing settled to state yet, and a client who just clicked deserves to see
    // the thing moving rather than a silent panel. Once ready the steps come off
    // and the record takes their place — same card, two states.
    steps:
      input.stage === "ready"
        ? undefined
        : PROPOSAL_STAGE_ORDER.map((step) => ({
            label: proposalStageLabel(step),
            detail: proposalStageDetail(step),
            status: proposalStepStatus(step, input.stage),
          })),
    rows: input.stage === "ready" ? rows : undefined,
    // The one thing the phase panel knew that this card didn't, moved here when
    // that panel came off: it was down to this sentence plus a copy of a link
    // that already lives in the rail. True for good — the proposal was emailed
    // when it was sent, and stays emailed.
    note: input.stage === "ready" ? "We've also emailed it to you." : undefined,
    action: input.proposalHref ? { label: "View proposal", href: input.proposalHref } : null,
  };
}
