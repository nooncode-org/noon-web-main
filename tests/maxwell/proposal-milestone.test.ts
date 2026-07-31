import { describe, expect, it } from "vitest";
import {
  buildProposalMilestone,
  proposalMilestoneTitle,
  proposalStageFromStatus,
  proposalStepStatus,
} from "@/lib/maxwell/proposal-milestone";

const FULL = {
  stage: "ready" as const,
  at: "2026-07-30T15:04:00.000Z",
  requestedBy: "priya@marlowcoffee.com",
  projectName: "A landing page for my coffee subscription",
  prototypeVersion: 3,
  proposalHref: "/en/maxwell/proposal/tok_123",
};

const label = (m: ReturnType<typeof buildProposalMilestone>, name: string) =>
  m.rows?.find((r) => r.label === name);

describe("proposalStageFromStatus", () => {
  // The stage is derived from the SAME list the public proposal page uses, so
  // "ready" can never mean anything other than "there is a page to open".
  it.each(["sent", "payment_pending", "payment_under_verification", "paid", "expired"])(
    "%s → ready",
    (status) => {
      expect(proposalStageFromStatus(status)).toBe("ready");
    },
  );

  it.each(["draft", "pending_review", "under_review", "approved", "returned"])(
    "%s → review (still with the team)",
    (status) => {
      expect(proposalStageFromStatus(status)).toBe("review");
    },
  );

  it("no proposal yet → drafting", () => {
    expect(proposalStageFromStatus(null)).toBe("drafting");
    expect(proposalStageFromStatus(undefined)).toBe("drafting");
  });
});

describe("proposalStepStatus", () => {
  it("marks past steps done, the current one active and the rest pending", () => {
    expect(proposalStepStatus("drafting", "review")).toBe("done");
    expect(proposalStepStatus("review", "review")).toBe("active");
    expect(proposalStepStatus("ready", "review")).toBe("pending");
  });

  it("has no high-water mark — going back is reported honestly", () => {
    expect(proposalStepStatus("review", "drafting")).toBe("pending");
  });
});

describe("proposalMilestoneTitle", () => {
  it("never outruns the facts", () => {
    expect(proposalMilestoneTitle("drafting")).toBe("Preparing your proposal");
    expect(proposalMilestoneTitle("review")).toBe("Preparing your proposal");
    expect(proposalMilestoneTitle("ready")).toBe("Your proposal is ready");
  });
});

describe("buildProposalMilestone", () => {
  it("states every fact it was given once ready", () => {
    const m = buildProposalMilestone(FULL);
    expect(m.at).toBe(FULL.at);
    // No status line: live state is the phase panel’s job, not a record’s.
    expect(m.status).toBeUndefined();
    expect(label(m, "Requested by")?.value).toBe("priya@marlowcoffee.com");
    expect(label(m, "Project")?.value).toBe("A landing page for my coffee subscription");
    expect(label(m, "Built from")?.chips).toEqual(["Prototype v3"]);
    expect(m.action).toEqual({ label: "View proposal", href: "/en/maxwell/proposal/tok_123" });
  });

  // Two states, one card: progress while it happens, the record once it settled.
  // Showing both at once would be a card that is somehow still running and
  // already finished.
  it("shows steps and no rows while it is still being prepared", () => {
    const m = buildProposalMilestone({ ...FULL, stage: "review", proposalHref: null });
    expect(m.rows).toBeUndefined();
    expect(m.steps?.map((s) => s.status)).toEqual(["done", "active", "pending"]);
    expect(m.steps?.[1].detail).toMatch(/15 minutes/);
  });

  it("shows rows and no steps once ready", () => {
    const m = buildProposalMilestone(FULL);
    expect(m.steps).toBeUndefined();
    expect(m.rows?.length).toBeGreaterThan(0);
  });

  // Inherited from the phase panel when it was removed. Unlike the status line
  // that was deleted for going stale, this stays true forever — but only once
  // there is something that has actually been emailed.
  it("notes the email delivery only once ready", () => {
    expect(buildProposalMilestone(FULL).note).toMatch(/emailed/i);
    expect(buildProposalMilestone({ ...FULL, stage: "review" }).note).toBeUndefined();
    expect(buildProposalMilestone({ ...FULL, stage: "drafting" }).note).toBeUndefined();
  });

  // Only the step actually running carries its note; the others would be
  // promising a wait that isn't theirs.
  it("attaches the wait note to the review step only", () => {
    const m = buildProposalMilestone({ ...FULL, stage: "drafting" });
    expect(m.steps?.[0].detail).toBeNull();
  });

  // The reviewer row is the whole point of the card: it is the one fact the
  // client cannot know on their own. It must never be dropped.
  it("always names the reviewer, even with nothing else to say", () => {
    const m = buildProposalMilestone({
      stage: "ready",
      at: null,
      requestedBy: null,
      projectName: null,
      prototypeVersion: null,
      proposalHref: null,
    });
    expect(label(m, "Reviewed by")).toEqual({
      label: "Reviewed by",
      value: "Noon team",
      noonAvatar: true,
    });
    expect(m.rows).toHaveLength(1);
  });

  it("omits rows it has no value for instead of padding them", () => {
    const m = buildProposalMilestone({ ...FULL, requestedBy: null, projectName: null });
    expect(label(m, "Requested by")).toBeUndefined();
    expect(label(m, "Project")).toBeUndefined();
    expect(label(m, "Built from")).toBeDefined();
  });

  // A goal summary of only whitespace is "no project name", not a blank row.
  it("treats a whitespace-only project name as absent, and trims the rest", () => {
    expect(label(buildProposalMilestone({ ...FULL, projectName: "   " }), "Project")).toBeUndefined();
    expect(label(buildProposalMilestone({ ...FULL, projectName: "  Coffee  " }), "Project")?.value).toBe(
      "Coffee",
    );
  });

  // Version 0 means no prototype was ever built — "Prototype v0" would be a lie
  // about something that doesn't exist.
  it("drops the prototype row when there is no version", () => {
    expect(label(buildProposalMilestone({ ...FULL, prototypeVersion: 0 }), "Built from")).toBeUndefined();
    expect(label(buildProposalMilestone({ ...FULL, prototypeVersion: null }), "Built from")).toBeUndefined();
  });

  // While the proposal is in review its token is withheld, so a button here
  // would lead to a 404. No link → no button.
  it("offers no action without a link", () => {
    expect(buildProposalMilestone({ ...FULL, proposalHref: null }).action).toBeNull();
  });
});
