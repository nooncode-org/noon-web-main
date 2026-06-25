import { describe, expect, it } from "vitest";
import type { ProposalStatus } from "@/lib/maxwell/repositories";
import {
  PUBLIC_PROPOSAL_STATUSES,
  isProposalPubliclyViewable,
} from "@/lib/maxwell/proposal-visibility";

/**
 * Locks the single source of truth shared by the public proposal page and the
 * Studio session route (which gates the owner-only `proposal_public_token` on
 * it). A status moving in/out of this set silently changes BOTH surfaces, so
 * the membership of the set is pinned explicitly here.
 */
describe("proposal visibility — public statuses", () => {
  const PUBLIC: ProposalStatus[] = [
    "sent",
    "payment_pending",
    "payment_under_verification",
    "paid",
    "expired",
  ];

  // Pre-delivery / terminal-internal statuses the public page 404s — and thus
  // must NOT leak a deep-link token.
  const NON_PUBLIC: ProposalStatus[] = [
    "pending_review",
    "under_review",
    "approved",
    "returned",
    "escalated",
  ];

  it.each(PUBLIC)("treats %s as publicly viewable", (status) => {
    expect(isProposalPubliclyViewable(status)).toBe(true);
    expect(PUBLIC_PROPOSAL_STATUSES.has(status)).toBe(true);
  });

  it.each(NON_PUBLIC)("treats %s as NOT publicly viewable", (status) => {
    expect(isProposalPubliclyViewable(status)).toBe(false);
    expect(PUBLIC_PROPOSAL_STATUSES.has(status)).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isProposalPubliclyViewable(null)).toBe(false);
    expect(isProposalPubliclyViewable(undefined)).toBe(false);
  });
});
