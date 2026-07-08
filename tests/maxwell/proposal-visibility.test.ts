import { describe, expect, it } from "vitest";
import type { ProposalStatus } from "@/lib/maxwell/repositories";
import {
  EXPIRABLE_PROPOSAL_STATUSES,
  PUBLIC_PROPOSAL_STATUSES,
  isProposalPastCutoff,
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

/**
 * SEC-M2 (auditoría 2026-07): el cutoff duro que convierte el token bearer
 * permanente en uno con expiry real. Página pública, checkout y payment
 * comparten este helper — pinnearlo aquí pinnea las tres superficies.
 */
describe("proposal visibility — hard cutoff (isProposalPastCutoff)", () => {
  const NOW = new Date("2026-07-08T12:00:00.000Z");
  const PAST = "2026-07-01T00:00:00.000Z";
  const FUTURE = "2026-08-01T00:00:00.000Z";

  it("only pre-payment statuses are expirable", () => {
    expect([...EXPIRABLE_PROPOSAL_STATUSES].sort()).toEqual(["payment_pending", "sent"]);
  });

  it.each(["sent", "payment_pending"] as ProposalStatus[])(
    "%s past expires_at → past cutoff",
    (status) => {
      expect(isProposalPastCutoff({ status, expiresAt: PAST }, NOW)).toBe(true);
    },
  );

  it.each(["sent", "payment_pending"] as ProposalStatus[])(
    "%s with future expires_at → not past cutoff",
    (status) => {
      expect(isProposalPastCutoff({ status, expiresAt: FUTURE }, NOW)).toBe(false);
    },
  );

  it.each(["paid", "payment_under_verification", "expired"] as ProposalStatus[])(
    "%s never hits the cutoff even with a past expires_at (payment already emitted / already expired)",
    (status) => {
      expect(isProposalPastCutoff({ status, expiresAt: PAST }, NOW)).toBe(false);
    },
  );

  it("expires_at NULL (never opened — clock not started) → not past cutoff", () => {
    expect(isProposalPastCutoff({ status: "sent", expiresAt: null }, NOW)).toBe(false);
  });

  it("malformed expires_at fails safe (not past cutoff)", () => {
    expect(isProposalPastCutoff({ status: "sent", expiresAt: "not-a-date" }, NOW)).toBe(false);
  });

  it("boundary: expires_at exactly now → past cutoff (inclusive)", () => {
    expect(
      isProposalPastCutoff({ status: "sent", expiresAt: NOW.toISOString() }, NOW),
    ).toBe(true);
  });
});
