/**
 * v3 membership billing M1 — checkout subscription branch (flag ON).
 *
 * Companion to stripe-checkout.test.ts (which covers the flag-OFF M0 fallback,
 * where a membership checkout stays `mode:"payment"`). Here the flag is mocked
 * ON, so a membership checkout becomes a Stripe subscription (Option A): a
 * one-time activation line item + a recurring monthly line item.
 */
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

// Flag ON for this file.
vi.mock("@/lib/maxwell/membership-billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/maxwell/membership-billing")>();
  return { ...actual, MEMBERSHIP_BILLING_ENABLED: true };
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

function buildRequest(body: Record<string, unknown>) {
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
    initialPrompt: "Build a membership test",
    goalSummary: "Membership test",
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
    pricing: { activation: "$4500 USD", monthly: "$69 USD/mes" },
    monthlyAmountUsd: 69,
    membershipRecommended: true,
  });
  mocks.buildPublicProposalUrl.mockReturnValue("https://noon.test/en/maxwell/proposal/public-token-abc");
  mocks.buildWebsiteProposalPayload.mockReturnValue({
    customer: { email: "client@noon.test" },
    proposal: { title: "Noon test proposal", amount: 4500, currency: "USD" },
  });
});

describe("POST /api/maxwell/checkout — membership flag ON", () => {
  it("creates a subscription Checkout with activation (one-time) + monthly (recurring)", async () => {
    mocks.getProposalRequestByPublicToken.mockResolvedValue(proposal());
    mocks.getStudioSession.mockResolvedValue(session());
    mocks.createCheckoutSession.mockResolvedValue({
      id: "cs_sub_1",
      url: "https://checkout.stripe.test/sub",
    });

    const res = await POST(buildRequest({ public_token: "public-token-abc", payment_modality: "membership" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ checkout_session_id: "cs_sub_1", reused: false });

    const [params, opts] = mocks.createCheckoutSession.mock.calls[0];
    expect(params.mode).toBe("subscription");

    // Activation = one-time line item (no recurring), $4500 → 450000 minor.
    const activationLine = params.line_items.find(
      (li: { price_data: { recurring?: unknown } }) => !li.price_data.recurring,
    );
    expect(activationLine.price_data.unit_amount).toBe(450000);

    // Monthly = recurring line item, $69 → 6900 minor, interval month.
    const monthlyLine = params.line_items.find(
      (li: { price_data: { recurring?: { interval?: string } } }) => li.price_data.recurring,
    );
    expect(monthlyLine.price_data.unit_amount).toBe(6900);
    expect(monthlyLine.price_data.recurring.interval).toBe("month");

    // Correlation metadata rides the subscription too (for webhook resolution).
    expect(params.subscription_data.metadata).toMatchObject({
      external_session_id: "session-1",
      external_proposal_id: "proposal-1",
      payment_modality: "membership",
    });
    // No one-time-only payment_intent_data in subscription mode.
    expect(params.payment_intent_data).toBeUndefined();

    expect(opts.idempotencyKey).toBe("noon-checkout-sub:proposal-1:450000:6900:usd");

    // The chosen modality + monthly are still persisted (M0 capture).
    expect(mocks.updateProposalRequest).toHaveBeenCalledWith("proposal-1", {
      paymentModality: "membership",
      monthlyAmountUsd: 69,
    });
  });

  it("falls back to one-time when modality is one_time even with the flag on", async () => {
    mocks.getProposalRequestByPublicToken.mockResolvedValue(proposal());
    mocks.getStudioSession.mockResolvedValue(session());
    mocks.createCheckoutSession.mockResolvedValue({
      id: "cs_ot_1",
      url: "https://checkout.stripe.test/ot",
    });

    await POST(buildRequest({ public_token: "public-token-abc", payment_modality: "one_time" }));

    const [params] = mocks.createCheckoutSession.mock.calls[0];
    expect(params.mode).toBe("payment");
  });
});
