import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors the stripe-webhook.test.ts harness: mock the Stripe client's
// `checkout.sessions.retrieve` + the shared `confirmProposalPayment`, keep the
// real `getStripeObjectId` (via importOriginal) so id extraction is exercised.
const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  confirmProposalPayment: vi.fn(),
}));

vi.mock("@/lib/stripe/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe/server")>();
  return {
    ...actual,
    getStripeClient: vi.fn(() => ({
      checkout: { sessions: { retrieve: mocks.retrieve } },
    })),
  };
});

vi.mock("@/lib/maxwell/payment-activation", () => ({
  confirmProposalPayment: mocks.confirmProposalPayment,
}));

vi.mock("@/lib/server/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { confirmStripeCheckoutReturn } from "@/lib/maxwell/checkout-return";

function oneTimeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_123",
    status: "complete",
    payment_status: "paid",
    mode: "payment",
    amount_total: 450000,
    currency: "usd",
    client_reference_id: "proposal-1",
    payment_intent: "pi_test_123",
    subscription: null,
    metadata: { external_session_id: "session-1", external_proposal_id: "proposal-1" },
    ...overrides,
  };
}

function subscriptionSession(overrides: Record<string, unknown> = {}) {
  return oneTimeSession({
    mode: "subscription",
    payment_intent: null,
    subscription: "sub_test_123",
    amount_total: 550000,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirmProposalPayment.mockResolvedValue({ idempotent: false });
});

describe("confirmStripeCheckoutReturn", () => {
  it("confirms a one-time paid session, asserting the paid amount", async () => {
    mocks.retrieve.mockResolvedValue(oneTimeSession());

    const result = await confirmStripeCheckoutReturn({
      checkoutSessionId: "cs_test_123",
      proposalId: "proposal-1",
    });

    expect(result).toEqual({ confirmed: true, idempotent: false });
    expect(mocks.confirmProposalPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalRequestId: "proposal-1",
        actor: "stripe-return",
        provider: "stripe",
        paymentReference: "pi_test_123",
        providerSessionId: "cs_test_123",
        providerPaymentIntentId: "pi_test_123",
        paidAmountMinor: 450000,
        paidCurrency: "usd",
      }),
    );
  });

  it("confirms a subscription session WITHOUT asserting the amount", async () => {
    // First invoice = activation + monthly, so a paid-amount assertion would
    // (correctly) fail — the return path omits it, exactly like the webhook.
    mocks.retrieve.mockResolvedValue(subscriptionSession());

    const result = await confirmStripeCheckoutReturn({
      checkoutSessionId: "cs_test_123",
      proposalId: "proposal-1",
    });

    expect(result.confirmed).toBe(true);
    const args = mocks.confirmProposalPayment.mock.calls[0][0];
    expect(args.paidAmountMinor).toBeUndefined();
    expect(args.paymentReference).toBe("sub_test_123");
    expect(args.providerSessionId).toBe("cs_test_123");
  });

  it("does NOT confirm an unpaid session", async () => {
    mocks.retrieve.mockResolvedValue(oneTimeSession({ payment_status: "unpaid" }));

    const result = await confirmStripeCheckoutReturn({
      checkoutSessionId: "cs_test_123",
      proposalId: "proposal-1",
    });

    expect(result).toEqual({ confirmed: false, idempotent: false });
    expect(mocks.confirmProposalPayment).not.toHaveBeenCalled();
  });

  it("does NOT confirm an incomplete (still open) session", async () => {
    mocks.retrieve.mockResolvedValue(oneTimeSession({ status: "open" }));

    const result = await confirmStripeCheckoutReturn({
      checkoutSessionId: "cs_test_123",
      proposalId: "proposal-1",
    });

    expect(result.confirmed).toBe(false);
    expect(mocks.confirmProposalPayment).not.toHaveBeenCalled();
  });

  it("refuses a session whose metadata points at a DIFFERENT proposal (security)", async () => {
    mocks.retrieve.mockResolvedValue(
      oneTimeSession({
        client_reference_id: "attacker-proposal",
        metadata: { external_proposal_id: "attacker-proposal" },
      }),
    );

    const result = await confirmStripeCheckoutReturn({
      checkoutSessionId: "cs_test_123",
      proposalId: "proposal-1",
    });

    expect(result).toEqual({ confirmed: false, idempotent: false });
    expect(mocks.confirmProposalPayment).not.toHaveBeenCalled();
  });

  it("passes through the idempotent flag when activation was a no-op", async () => {
    mocks.retrieve.mockResolvedValue(oneTimeSession());
    mocks.confirmProposalPayment.mockResolvedValue({ idempotent: true });

    const result = await confirmStripeCheckoutReturn({
      checkoutSessionId: "cs_test_123",
      proposalId: "proposal-1",
    });

    expect(result).toEqual({ confirmed: true, idempotent: true });
  });
});
