import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  confirmProposalPayment: vi.fn(),
}));

vi.mock("@/lib/stripe/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe/server")>();
  return {
    ...actual,
    getStripeWebhookSecret: vi.fn(() => "whsec_test"),
    getStripeClient: vi.fn(() => ({
      webhooks: {
        constructEvent: mocks.constructEvent,
      },
    })),
  };
});

vi.mock("@/lib/maxwell/payment-activation", () => {
  class PaymentActivationError extends Error {
    constructor(
      message: string,
      public readonly status = 409,
      public readonly code = "PAYMENT_ACTIVATION_FAILED",
    ) {
      super(message);
      this.name = "PaymentActivationError";
    }
  }

  return {
    PaymentActivationError,
    confirmProposalPayment: mocks.confirmProposalPayment,
  };
});

import { POST } from "@/app/api/stripe/webhook/route";
import { PaymentActivationError } from "@/lib/maxwell/payment-activation";

const ROUTE_URL = "http://localhost/api/stripe/webhook";

function buildRequest(body = "{}", signature = "sig_test") {
  return new Request(ROUTE_URL, {
    method: "POST",
    headers: { "stripe-signature": signature },
    body,
  });
}

function checkoutCompletedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_checkout_completed",
    type: "checkout.session.completed",
    created: 1_778_000_000,
    data: {
      object: {
        id: "cs_test_123",
        payment_status: "paid",
        amount_total: 450000,
        currency: "usd",
        client_reference_id: "proposal-1",
        payment_intent: "pi_test_123",
        metadata: {
          external_session_id: "session-1",
          external_proposal_id: "proposal-1",
        },
        ...overrides,
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirmProposalPayment.mockResolvedValue({
    idempotent: false,
    proposal: { status: "paid" },
    workspace: { id: "workspace-1" },
  });
});

describe("POST /api/stripe/webhook", () => {
  it("rejects missing Stripe signatures", async () => {
    const res = await POST(new Request(ROUTE_URL, { method: "POST", body: "{}" }));

    expect(res.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });

  it("rejects invalid Stripe signatures", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("Signature verification failed");
    });

    const res = await POST(buildRequest());

    expect(res.status).toBe(400);
    expect(mocks.confirmProposalPayment).not.toHaveBeenCalled();
  });

  it("ignores unsupported Stripe event types", async () => {
    mocks.constructEvent.mockReturnValue({ id: "evt_1", type: "payment_intent.created", data: {} });

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ received: true, ignored: true });
    expect(mocks.confirmProposalPayment).not.toHaveBeenCalled();
  });

  it("ignores unpaid checkout sessions", async () => {
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent({ payment_status: "unpaid" }));

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ignored: true });
    expect(mocks.confirmProposalPayment).not.toHaveBeenCalled();
  });

  it("activates a paid checkout session through the shared payment service", async () => {
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent());

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      handled: true,
      proposal_status: "paid",
      workspace_id: "workspace-1",
    });
    expect(mocks.confirmProposalPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalRequestId: "proposal-1",
        actor: "stripe",
        paymentReference: "pi_test_123",
        provider: "stripe",
        providerEventId: "evt_checkout_completed",
        providerSessionId: "cs_test_123",
        providerPaymentIntentId: "pi_test_123",
        paidAmountMinor: 450000,
        paidCurrency: "usd",
      }),
    );
  });

  it("surfaces payment activation mismatches as controlled conflicts", async () => {
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent());
    mocks.confirmProposalPayment.mockRejectedValue(
      new PaymentActivationError("Amount mismatch", 409, "PAYMENT_AMOUNT_MISMATCH"),
    );

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toMatchObject({ code: "PAYMENT_AMOUNT_MISMATCH" });
  });
});
