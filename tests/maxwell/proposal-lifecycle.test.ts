import { describe, expect, it } from "vitest";
import {
  PROPOSAL_REVIEW_AUTO_SEND_MINUTES,
  PROPOSAL_REVIEW_ESCALATION_MINUTES,
  PROPOSAL_REVIEW_REMINDER_MINUTES,
  PROPOSAL_VALIDITY_DAYS,
  buildProposalReviewTimeline,
  classifyProposalCase,
  deriveProposalExpiry,
  evaluateProposalReviewSla,
} from "@/lib/maxwell/proposal-lifecycle";
import type { ProposalRequest } from "@/lib/maxwell/repositories";

function makeProposal(overrides: Partial<ProposalRequest> = {}): ProposalRequest {
  return {
    id: "proposal-1",
    studioSessionId: "session-1",
    versionNumber: 1,
    publicToken: "token-1",
    status: "pending_review",
    caseClassification: "normal",
    reviewRequired: true,
    reviewerId: null,
    draftContent: "Draft",
    deliveryChannel: "email",
    deliveryStatus: "pending_review",
    deliveryRecipient: "client@example.com",
    approvedAmountUsd: null,
    approvedCurrency: null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripePaidAt: null,
    sentAt: null,
    firstOpenedAt: null,
    expiresAt: null,
    reviewNotifiedAt: "2026-04-06T10:00:00.000Z",
    reviewRemindedAt: null,
    reviewEscalatedAt: null,
    autoSendDueAt: "2026-04-06T10:15:00.000Z",
    supersedesProposalRequestId: null,
    supersededByProposalRequestId: null,
    createdAt: "2026-04-06T10:00:00.000Z",
    updatedAt: "2026-04-06T10:00:00.000Z",
    ...overrides,
  };
}

describe("buildProposalReviewTimeline", () => {
  it("computes the 5/10/15 review thresholds from the notification timestamp", () => {
    const timeline = buildProposalReviewTimeline("2026-04-06T10:00:00.000Z");

    expect(timeline.reminderDueAt).toBe(
      new Date(Date.UTC(2026, 3, 6, 10, PROPOSAL_REVIEW_REMINDER_MINUTES)).toISOString()
    );
    expect(timeline.escalationDueAt).toBe(
      new Date(Date.UTC(2026, 3, 6, 10, PROPOSAL_REVIEW_ESCALATION_MINUTES)).toISOString()
    );
    expect(timeline.autoSendDueAt).toBe(
      new Date(Date.UTC(2026, 3, 6, 10, PROPOSAL_REVIEW_AUTO_SEND_MINUTES)).toISOString()
    );
  });
});

describe("deriveProposalExpiry", () => {
  it("starts validity from the first real opening", () => {
    const expiry = deriveProposalExpiry("2026-04-06T10:00:00.000Z");
    expect(expiry).toBe(
      new Date(Date.UTC(2026, 3, 6 + PROPOSAL_VALIDITY_DAYS, 10, 0, 0)).toISOString()
    );
  });
});

describe("classifyProposalCase", () => {
  it("defaults to normal when there are no review warnings", () => {
    expect(classifyProposalCase({ warningCount: 0 })).toBe("normal");
  });

  it("promotes proposals with warnings to special by default", () => {
    expect(classifyProposalCase({ warningCount: 2 })).toBe("special");
  });

  it("respects an explicit override", () => {
    expect(classifyProposalCase({ warningCount: 3, forcedClassification: "normal" })).toBe("normal");
  });
});

describe("evaluateProposalReviewSla", () => {
  it("does nothing before the reminder threshold", () => {
    const decision = evaluateProposalReviewSla(
      makeProposal(),
      "2026-04-06T10:04:59.000Z"
    );

    expect(decision).toEqual({
      shouldRemind: false,
      shouldEscalate: false,
      shouldAutoSend: false,
      blockedReason: null,
    });
  });

  it("reminds at 5 minutes and escalates at 10 minutes", () => {
    const reminder = evaluateProposalReviewSla(
      makeProposal(),
      "2026-04-06T10:05:00.000Z"
    );
    expect(reminder.shouldRemind).toBe(true);
    expect(reminder.shouldEscalate).toBe(false);

    const escalation = evaluateProposalReviewSla(
      makeProposal(),
      "2026-04-06T10:10:00.000Z"
    );
    expect(escalation.shouldRemind).toBe(true);
    expect(escalation.shouldEscalate).toBe(true);
  });

  it("auto-sends only normal cases with a recipient at 15 minutes", () => {
    const decision = evaluateProposalReviewSla(
      makeProposal(),
      "2026-04-06T10:15:00.000Z"
    );

    expect(decision).toEqual({
      shouldRemind: true,
      shouldEscalate: true,
      shouldAutoSend: true,
      blockedReason: null,
    });
  });

  it("blocks special cases from auto-send", () => {
    const decision = evaluateProposalReviewSla(
      makeProposal({ caseClassification: "special" }),
      "2026-04-06T10:15:00.000Z"
    );

    expect(decision.shouldAutoSend).toBe(false);
    expect(decision.blockedReason).toBe("special_case");
  });

  it("blocks auto-send if no recipient email exists", () => {
    const decision = evaluateProposalReviewSla(
      makeProposal({ deliveryRecipient: null }),
      "2026-04-06T10:15:00.000Z"
    );

    expect(decision.shouldAutoSend).toBe(false);
    expect(decision.blockedReason).toBe("missing_recipient");
  });

  it("stops emitting SLA actions after a proposal was already sent", () => {
    const decision = evaluateProposalReviewSla(
      makeProposal({
        status: "sent",
        sentAt: "2026-04-06T10:12:00.000Z",
        deliveryStatus: "sent",
      }),
      "2026-04-06T10:20:00.000Z"
    );

    expect(decision).toEqual({
      shouldRemind: false,
      shouldEscalate: false,
      shouldAutoSend: false,
      blockedReason: null,
    });
  });
});
