import { describe, expect, it } from "vitest";
import { buildProposalMilestone } from "@/lib/maxwell/proposal-milestone";

const FULL = {
  at: "2026-07-30T15:04:00.000Z",
  requestedBy: "priya@marlowcoffee.com",
  projectName: "A landing page for my coffee subscription",
  prototypeVersion: 3,
  proposalHref: "/en/maxwell/proposal/tok_123",
};

const label = (m: ReturnType<typeof buildProposalMilestone>, name: string) =>
  m.rows?.find((r) => r.label === name);

describe("buildProposalMilestone", () => {
  it("states every fact it was given", () => {
    const m = buildProposalMilestone(FULL);
    expect(m.at).toBe(FULL.at);
    // No status line: live state is the phase panel’s job, not a record’s.
    expect(m.status).toBeUndefined();
    expect(label(m, "Requested by")?.value).toBe("priya@marlowcoffee.com");
    expect(label(m, "Project")?.value).toBe("A landing page for my coffee subscription");
    expect(label(m, "Built from")?.chips).toEqual(["Prototype v3"]);
    expect(m.action).toEqual({ label: "View proposal", href: "/en/maxwell/proposal/tok_123" });
  });

  // The reviewer row is the whole point of the card: it is the one fact the
  // client cannot know on their own. It must never be dropped.
  it("always names the reviewer, even with nothing else to say", () => {
    const m = buildProposalMilestone({
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
