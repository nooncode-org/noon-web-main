/**
 * One-time buyer + YEARLY hosting — checkout branch (flag ON).
 *
 * The one-time client pays for the build once and then keeps the site online
 * with a yearly hosting fee (owner 2026-07-22; $300/yr set 2026-07-23). Same
 * Option A shape as the membership — ONE subscription whose first invoice also
 * carries the one-time build line — only the interval is `year`, so the webhook,
 * the Billing Portal and the lifecycle wire need no new plumbing.
 *
 * Companion to stripe-checkout-membership.test.ts (monthly) and
 * stripe-checkout.test.ts (which covers the flag-OFF fallback: a one-time
 * checkout stays a single `mode:"payment"` charge).
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

// Hosting switch ON for this file (it ships OFF — flipping it changes what a
// real client pays, so it's a deliberate business action).
vi.mock("@/lib/maxwell/hosting-billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/maxwell/hosting-billing")>();
  return {
    ...actual,
    HOSTING_BILLING_ENABLED: true,
    shouldBillHosting: (m: string) => m === "one_time",
  };
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
import { HOSTING_YEARLY_USD } from "@/lib/maxwell/hosting-billing";

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
    initialPrompt: "Build a hosting test",
    goalSummary: "Hosting test",
    ...overrides,
  };
}

type Line = { price_data: { unit_amount: number; recurring?: { interval?: string } } };

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
    membershipRecommended: false,
  });
  mocks.buildPublicProposalUrl.mockReturnValue(
    "https://noon.test/en/maxwell/proposal/public-token-abc",
  );
  mocks.buildWebsiteProposalPayload.mockReturnValue({
    customer: { email: "client@noon.test" },
    proposal: { title: "Noon test proposal", amount: 4500, currency: "USD" },
  });
  mocks.getProposalRequestByPublicToken.mockResolvedValue(proposal());
  mocks.getStudioSession.mockResolvedValue(session());
  mocks.createCheckoutSession.mockResolvedValue({
    id: "cs_host_1",
    client_secret: "cs_secret_host",
  });
});

describe("POST /api/maxwell/checkout — one-time + yearly hosting (flag ON)", () => {
  it("creates a subscription with the build one-time and hosting recurring YEARLY", async () => {
    const res = await POST(
      buildRequest({ public_token: "public-token-abc", payment_modality: "one_time" }),
    );
    expect(res.status).toBe(200);

    const [params] = mocks.createCheckoutSession.mock.calls[0];
    expect(params.mode).toBe("subscription");
    expect(params.ui_mode).toBe("embedded_page");

    // The build = one-time line (no `recurring`), $4500 → 450000 minor.
    const buildLine = (params.line_items as Line[]).find((li) => !li.price_data.recurring)!;
    expect(buildLine.price_data.unit_amount).toBe(450000);

    // Hosting = recurring line, $300 → 30000 minor, interval YEAR (not month).
    const hostingLine = (params.line_items as Line[]).find((li) => li.price_data.recurring)!;
    expect(hostingLine.price_data.unit_amount).toBe(HOSTING_YEARLY_USD * 100);
    expect(hostingLine.price_data.recurring!.interval).toBe("year");
  });

  it("bills exactly two lines — the domain is NOT folded in", async () => {
    await POST(buildRequest({ public_token: "public-token-abc", payment_modality: "one_time" }));
    const [params] = mocks.createCheckoutSession.mock.calls[0];
    expect(params.line_items).toHaveLength(2);
  });

  it("marks the subscription as hosting so the webhook can tell it from a membership", async () => {
    await POST(buildRequest({ public_token: "public-token-abc", payment_modality: "one_time" }));
    const [params] = mocks.createCheckoutSession.mock.calls[0];

    expect(params.subscription_data.metadata).toMatchObject({
      external_session_id: "session-1",
      external_proposal_id: "proposal-1",
      payment_modality: "one_time",
      hosting_yearly_usd: String(HOSTING_YEARLY_USD),
      billing_interval: "year",
    });
    // Subscription mode has no one-time-only payment_intent_data.
    expect(params.payment_intent_data).toBeUndefined();
  });

  it("keys idempotency on both amounts so a re-price can't reuse a stale session", async () => {
    await POST(buildRequest({ public_token: "public-token-abc", payment_modality: "one_time" }));
    const [, opts] = mocks.createCheckoutSession.mock.calls[0];
    expect(opts.idempotencyKey).toBe("noon-checkout-host-emb:proposal-1:450000:30000:usd");
  });

  it("does NOT put hosting on a membership — its monthly already covers it", async () => {
    await POST(buildRequest({ public_token: "public-token-abc", payment_modality: "membership" }));
    const [params] = mocks.createCheckoutSession.mock.calls[0];
    const recurring = (params.line_items as Line[]).filter((li) => li.price_data.recurring);
    // Exactly one recurring line, and it is the MONTHLY membership — never yearly.
    expect(recurring).toHaveLength(1);
    expect(recurring[0].price_data.recurring!.interval).toBe("month");
    expect(params.subscription_data.metadata.hosting_yearly_usd).toBeUndefined();
  });
});
