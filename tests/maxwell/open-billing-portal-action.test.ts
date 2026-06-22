/**
 * v3 membership billing M2 — openBillingPortal server action (flag ON).
 *
 * Covers auth, ownership, the no-subscription gate, rate-limiting, the success
 * path (returns the Stripe portal URL), and clean degradation when Stripe throws
 * (e.g. the dashboard Customer portal config isn't activated).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  viewerOwnsStudioSession: vi.fn(),
  getStudioSession: vi.fn(),
  getLatestProposalRequest: vi.fn(),
  buildWorkspaceUrl: vi.fn(),
  enforceRateLimit: vi.fn(),
  createPortalSession: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/lib/auth/ownership", () => ({
  viewerOwnsStudioSession: mocks.viewerOwnsStudioSession,
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  getStudioSession: mocks.getStudioSession,
  getLatestProposalRequest: mocks.getLatestProposalRequest,
}));

vi.mock("@/lib/maxwell/public-url", () => ({
  buildWorkspaceUrl: mocks.buildWorkspaceUrl,
}));

vi.mock("@/lib/server/rate-limit", () => {
  class RateLimitExceededError extends Error {}
  return { enforceRateLimit: mocks.enforceRateLimit, RateLimitExceededError };
});

vi.mock("@/lib/maxwell/membership-billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/maxwell/membership-billing")>();
  return { ...actual, MEMBERSHIP_BILLING_ENABLED: true };
});

vi.mock("@/lib/stripe/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe/server")>();
  return {
    ...actual,
    getStripeClient: vi.fn(() => ({
      billingPortal: { sessions: { create: mocks.createPortalSession } },
    })),
  };
});

import { openBillingPortal } from "@/app/[locale]/maxwell/workspace/[sessionId]/_actions/open-billing-portal";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { email: "client@noon.test" } });
  mocks.viewerOwnsStudioSession.mockReturnValue(true);
  mocks.getStudioSession.mockResolvedValue({ id: "session-1", language: "en" });
  mocks.getLatestProposalRequest.mockResolvedValue({ id: "proposal-1", stripeCustomerId: "cus_1" });
  mocks.buildWorkspaceUrl.mockReturnValue("https://noon.test/en/maxwell/workspace/session-1");
  mocks.enforceRateLimit.mockReturnValue(undefined);
  mocks.createPortalSession.mockResolvedValue({ url: "https://billing.stripe.test/portal/abc" });
});

describe("openBillingPortal", () => {
  it("returns the Stripe portal URL for an owner with an active membership", async () => {
    const res = await openBillingPortal({ sessionId: "session-1" });

    expect(res).toEqual({ ok: true, url: "https://billing.stripe.test/portal/abc" });
    expect(mocks.createPortalSession).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://noon.test/en/maxwell/workspace/session-1",
    });
  });

  it("rejects an unauthenticated viewer", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await openBillingPortal({ sessionId: "session-1" });
    expect(res).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(mocks.createPortalSession).not.toHaveBeenCalled();
  });

  it("rejects a non-owner with NOT_FOUND", async () => {
    mocks.viewerOwnsStudioSession.mockReturnValue(false);
    const res = await openBillingPortal({ sessionId: "session-1" });
    expect(res).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(mocks.createPortalSession).not.toHaveBeenCalled();
  });

  it("returns NOT_AVAILABLE when there's no Stripe customer (no subscription)", async () => {
    mocks.getLatestProposalRequest.mockResolvedValue({ id: "proposal-1", stripeCustomerId: null });
    const res = await openBillingPortal({ sessionId: "session-1" });
    expect(res).toMatchObject({ ok: false, code: "NOT_AVAILABLE" });
    expect(mocks.createPortalSession).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED when the limiter trips", async () => {
    const { RateLimitExceededError } = await import("@/lib/server/rate-limit");
    mocks.enforceRateLimit.mockImplementation(() => {
      throw new RateLimitExceededError(1, "maxwell.billing-portal");
    });
    const res = await openBillingPortal({ sessionId: "session-1" });
    expect(res).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(mocks.createPortalSession).not.toHaveBeenCalled();
  });

  it("degrades to PORTAL_FAILED when Stripe throws (e.g. portal not configured)", async () => {
    mocks.createPortalSession.mockRejectedValue(new Error("No configuration provided"));
    const res = await openBillingPortal({ sessionId: "session-1" });
    expect(res).toMatchObject({ ok: false, code: "PORTAL_FAILED" });
  });
});
