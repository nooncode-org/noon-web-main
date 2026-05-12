import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProposalRequestByPublicToken: vi.fn(),
  getStudioSession: vi.fn(),
  getStudioVersions: vi.fn(),
  updateProposalRequestStatus: vi.fn(),
  appendPaymentEvent: vi.fn(),
  buildWebsiteProposalPayload: vi.fn(),
  buildPublicProposalUrl: vi.fn(),
  retrieveCheckoutSession: vi.fn(),
  createCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  getProposalRequestByPublicToken: mocks.getProposalRequestByPublicToken,
  getStudioSession: mocks.getStudioSession,
  getStudioVersions: mocks.getStudioVersions,
  updateProposalRequestStatus: mocks.updateProposalRequestStatus,
  appendPaymentEvent: mocks.appendPaymentEvent,
}));

vi.mock("@/lib/noon-app-integration", () => ({
  buildWebsiteProposalPayload: mocks.buildWebsiteProposalPayload,
}));

vi.mock("@/lib/maxwell/public-url", () => ({
  buildPublicProposalUrl: mocks.buildPublicProposalUrl,
}));

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

function buildRequest(publicToken = "public-token-abc") {
  return new Request(ROUTE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ public_token: publicToken }),
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
  mocks.updateProposalRequestStatus.mockResolvedValue(proposal({ status: "payment_pending" }));
  mocks.appendPaymentEvent.mockResolvedValue({});
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
});
