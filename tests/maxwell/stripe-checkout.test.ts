import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProposalRequestByPublicToken: vi.fn(),
  getStudioSession: vi.fn(),
  getStudioVersions: vi.fn(),
  updateProposalRequest: vi.fn(),
  updateProposalRequestStatus: vi.fn(),
  appendPaymentEvent: vi.fn(),
  buildWebsiteProposalPayload: vi.fn(),
  buildPublicProposalUrl: vi.fn(),
  resolveProposalCommercialProfile: vi.fn(),
  retrieveCheckoutSession: vi.fn(),
  createCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  getProposalRequestByPublicToken: mocks.getProposalRequestByPublicToken,
  getStudioSession: mocks.getStudioSession,
  getStudioVersions: mocks.getStudioVersions,
  updateProposalRequest: mocks.updateProposalRequest,
  updateProposalRequestStatus: mocks.updateProposalRequestStatus,
  appendPaymentEvent: mocks.appendPaymentEvent,
}));

vi.mock("@/lib/noon-app-integration", () => ({
  buildWebsiteProposalPayload: mocks.buildWebsiteProposalPayload,
}));

vi.mock("@/lib/maxwell/proposal-rules", () => ({
  resolveProposalCommercialProfile: mocks.resolveProposalCommercialProfile,
}));

vi.mock("@/lib/maxwell/public-url", () => ({
  buildPublicProposalUrl: mocks.buildPublicProposalUrl,
}));

// Flag OFF here — this file covers the M0 / kill-switch fallback (a membership
// checkout stays `mode:"payment"`). The flag-ON subscription path lives in
// stripe-checkout-membership.test.ts. Since the real constant is now `true`
// (enabled 2026-06-22), this mock keeps the kill-switch case deterministic.
vi.mock("@/lib/maxwell/membership-billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/maxwell/membership-billing")>();
  return { ...actual, MEMBERSHIP_BILLING_ENABLED: false };
});

vi.mock("@/lib/stripe/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe/server")>();
  return {
    ...actual,
    getStripeClient: vi.fn(() => ({
      checkout: {
        sessions: {
          retrieve: mocks.retrieveCheckoutSession,
          create: mocks.createCheckoutSession,
        },
      },
    })),
  };
});

import { POST } from "@/app/api/maxwell/checkout/route";

const ROUTE_URL = "http://localhost/api/maxwell/checkout";

function buildRequest(body: Record<string, unknown> = { public_token: "public-token-abc" }) {
  return new Request(ROUTE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: "proposal-1",
    studioSessionId: "session-1",
    publicToken: "public-token-abc",
    status: "sent",
    approvedAmountUsd: 4500,
    approvedCurrency: "USD",
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripePaidAt: null,
    deliveryRecipient: "client@noon.test",
    ...overrides,
  };
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    status: "proposal_sent",
    ownerEmail: "client@noon.test",
    ownerName: "Client",
    initialPrompt: "Build a checkout test",
    goalSummary: "Checkout test",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStudioVersions.mockResolvedValue([]);
  mocks.updateProposalRequest.mockResolvedValue(proposal());
  mocks.updateProposalRequestStatus.mockResolvedValue(proposal({ status: "payment_pending" }));
  mocks.appendPaymentEvent.mockResolvedValue({});
  mocks.resolveProposalCommercialProfile.mockReturnValue({
    category: "webapp",
    tier: "medio",
    pricing: { activation: "$179 USD", monthly: "$69 USD/mes" },
    monthlyAmountUsd: 69,
    membershipRecommended: true,
  });
  mocks.buildPublicProposalUrl.mockReturnValue("https://noon.test/en/maxwell/proposal/public-token-abc");
  mocks.buildWebsiteProposalPayload.mockReturnValue({
    customer: { email: "client@noon.test" },
    proposal: { title: "Noon test proposal", amount: 4500, currency: "USD" },
  });
});

describe("POST /api/maxwell/checkout", () => {
  it("rejects an invalid public token", async () => {
    mocks.getProposalRequestByPublicToken.mockResolvedValue(null);

    const res = await POST(buildRequest());

    expect(res.status).toBe(404);
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects proposals that are not payable", async () => {
    mocks.getProposalRequestByPublicToken.mockResolvedValue(proposal({ status: "pending_review" }));

    const res = await POST(buildRequest());

    expect(res.status).toBe(409);
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  // SEC-M2 (auditoría 2026-07): el cutoff duro cierra el checkout aunque el
  // status siga en 'sent' (nadie flipeó a 'expired' manualmente).
  it("rejects with 410 a 'sent' proposal past its expires_at (hard cutoff)", async () => {
    mocks.getProposalRequestByPublicToken.mockResolvedValue(
      proposal({ status: "sent", expiresAt: "2020-01-01T00:00:00.000Z" }),
    );

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(410);
    expect(body.code).toBe("PROPOSAL_EXPIRED");
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("still accepts a 'sent' proposal with a future expires_at", async () => {
    mocks.getProposalRequestByPublicToken.mockResolvedValue(
      proposal({ status: "sent", expiresAt: new Date(Date.now() + 86_400_000).toISOString() }),
    );
    mocks.getStudioSession.mockResolvedValue(session());
    mocks.createCheckoutSession.mockResolvedValue({
      id: "cs_new",
      status: "open",
      url: "https://checkout.stripe.test/new",
    });

    const res = await POST(buildRequest());
    expect(res.status).toBe(200);
  });

  it("rejects proposals without an approved USD amount", async () => {
    mocks.getProposalRequestByPublicToken.mockResolvedValue(
      proposal({ approvedAmountUsd: null, approvedCurrency: null }),
    );
    mocks.getStudioSession.mockResolvedValue(session());

    const res = await POST(buildRequest());

    expect(res.status).toBe(409);
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("reuses an open Stripe Checkout Session", async () => {
    mocks.getProposalRequestByPublicToken.mockResolvedValue(
      proposal({ status: "payment_pending", stripeCheckoutSessionId: "cs_open" }),
    );
    mocks.getStudioSession.mockResolvedValue(session());
    mocks.retrieveCheckoutSession.mockResolvedValue({
      id: "cs_open",
      status: "open",
      url: "https://checkout.stripe.test/reuse",
    });

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      checkout_url: "https://checkout.stripe.test/reuse",
      checkout_session_id: "cs_open",
      reused: true,
    });
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("creates a Stripe Checkout Session with stable metadata and idempotency", async () => {
    mocks.getProposalRequestByPublicToken.mockResolvedValue(proposal());
    mocks.getStudioSession.mockResolvedValue(session());
    mocks.createCheckoutSession.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.test/pay",
    });

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      checkout_url: "https://checkout.stripe.test/pay",
      checkout_session_id: "cs_test_123",
      reused: false,
    });

    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        client_reference_id: "proposal-1",
        customer_email: "client@noon.test",
        metadata: expect.objectContaining({
          source: "noon_website",
          external_session_id: "session-1",
          external_proposal_id: "proposal-1",
          amount_usd: "4500",
          currency: "USD",
        }),
      }),
      expect.objectContaining({
        idempotencyKey: "noon-checkout:proposal-1:450000:usd",
      }),
    );
    expect(mocks.updateProposalRequestStatus).toHaveBeenCalledWith(
      "proposal-1",
      "payment_pending",
      expect.objectContaining({ stripeCheckoutSessionId: "cs_test_123" }),
    );
    expect(mocks.appendPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "initiated",
        provider: "stripe",
        providerSessionId: "cs_test_123",
      }),
    );
  });

  it("defaults to one_time and persists it without a recurring monthly", async () => {
    mocks.getProposalRequestByPublicToken.mockResolvedValue(proposal());
    mocks.getStudioSession.mockResolvedValue(session());
    mocks.createCheckoutSession.mockResolvedValue({
      id: "cs_one_time",
      url: "https://checkout.stripe.test/pay",
    });

    await POST(buildRequest());

    expect(mocks.updateProposalRequest).toHaveBeenCalledWith("proposal-1", {
      paymentModality: "one_time",
      monthlyAmountUsd: null,
    });
    // one_time never derives a monthly from the engine.
    expect(mocks.resolveProposalCommercialProfile).not.toHaveBeenCalled();
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          payment_modality: "one_time",
          monthly_amount_usd: "",
        }),
      }),
      expect.anything(),
    );
  });

  it("persists membership with the engine-derived monthly; activation charge unchanged", async () => {
    mocks.getProposalRequestByPublicToken.mockResolvedValue(proposal());
    mocks.getStudioSession.mockResolvedValue(session());
    mocks.createCheckoutSession.mockResolvedValue({
      id: "cs_membership",
      url: "https://checkout.stripe.test/pay",
    });

    await POST(buildRequest({ public_token: "public-token-abc", payment_modality: "membership" }));

    expect(mocks.resolveProposalCommercialProfile).toHaveBeenCalled();
    expect(mocks.updateProposalRequest).toHaveBeenCalledWith("proposal-1", {
      paymentModality: "membership",
      monthlyAmountUsd: 69,
    });
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        // The charged amount stays the PM-approved activation (one-time);
        // the monthly is metadata only — NOT a Stripe recurring line item (M0).
        mode: "payment",
        metadata: expect.objectContaining({
          payment_modality: "membership",
          monthly_amount_usd: "69",
          amount_usd: "4500",
        }),
      }),
      expect.anything(),
    );
  });
});
