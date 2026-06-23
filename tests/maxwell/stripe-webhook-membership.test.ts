/**
 * v3 membership billing M1 — Stripe webhook recurring lifecycle (flag ON).
 *
 * Covers the routing + Stripe→wire mapping for the subscription lifecycle:
 *   - subscription-mode checkout.session.completed → activation + forward `activated`
 *   - invoice.paid (subscription_cycle) → `renewed`/active
 *   - invoice.paid (subscription_create) → ignored (no double activated/renewed)
 *   - invoice.payment_failed → `payment_failed`/past_due
 *   - customer.subscription.updated → `updated` + mapped status
 *   - customer.subscription.deleted → `cancelled`/ended
 *   - unmapped subscription → ignored (no 5xx loop)
 *   - one-time checkout still routes to the existing activation (regression guard)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirmProposalPayment: vi.fn(),
  getProposalRequest: vi.fn(),
  getProposalRequestBySub: vi.fn(),
  updateProposalRequest: vi.fn(),
  sendMembershipLifecycle: vi.fn(),
  constructEvent: vi.fn(),
  retrieveSubscription: vi.fn(),
}));

vi.mock("@/lib/maxwell/payment-activation", () => {
  class PaymentActivationError extends Error {
    constructor(
      message: string,
      public readonly status = 409,
      public readonly code = "PAYMENT_ACTIVATION_FAILED",
    ) {
      super(message);
    }
  }
  return { confirmProposalPayment: mocks.confirmProposalPayment, PaymentActivationError };
});

vi.mock("@/lib/maxwell/repositories", () => ({
  getProposalRequest: mocks.getProposalRequest,
  getProposalRequestByStripeSubscriptionId: mocks.getProposalRequestBySub,
  updateProposalRequest: mocks.updateProposalRequest,
}));

vi.mock("@/lib/noon-app-integration", () => {
  class NoonAppIntegrationError extends Error {
    constructor(
      message: string,
      public readonly status = 502,
    ) {
      super(message);
    }
  }
  return { sendMembershipLifecycleToNoonApp: mocks.sendMembershipLifecycle, NoonAppIntegrationError };
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
      webhooks: { constructEvent: mocks.constructEvent },
      subscriptions: { retrieve: mocks.retrieveSubscription },
    })),
    getStripeWebhookSecret: vi.fn(() => "whsec_test"),
  };
});

import { POST } from "@/app/api/stripe/webhook/route";
import { NoonAppIntegrationError } from "@/lib/noon-app-integration";

const PERIOD_END_UNIX = 1_700_600_000;
const PERIOD_END_ISO = new Date(PERIOD_END_UNIX * 1000).toISOString();
const CREATED = 1_700_000_000;

function subscriptionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "active",
    metadata: { external_proposal_id: "proposal-1" },
    items: { data: [{ current_period_end: PERIOD_END_UNIX }] },
    ...overrides,
  };
}

function proposalFixture() {
  return { id: "proposal-1", studioSessionId: "session-1", monthlyAmountUsd: 69, status: "paid" };
}

async function post() {
  const req = new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig" },
    body: "{}",
  });
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendMembershipLifecycle.mockResolvedValue(null);
  mocks.updateProposalRequest.mockResolvedValue(proposalFixture());
  mocks.retrieveSubscription.mockResolvedValue(subscriptionFixture());
});

describe("subscription checkout completed → activation + forward", () => {
  it("persists correlation ids, activates (no strict total match), forwards `activated`", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      created: CREATED,
      data: {
        object: {
          id: "cs_1",
          mode: "subscription",
          payment_status: "paid",
          subscription: "sub_1",
          customer: "cus_1",
          client_reference_id: "proposal-1",
          currency: "usd",
          metadata: { external_proposal_id: "proposal-1", external_session_id: "session-1" },
        },
      },
    });
    mocks.confirmProposalPayment.mockResolvedValue({
      proposal: proposalFixture(),
      session: { id: "session-1" },
      workspace: { id: "ws_1" },
      paymentEvent: {},
      idempotent: false,
    });

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ membership: true, handled: true, workspace_id: "ws_1" });

    expect(mocks.updateProposalRequest).toHaveBeenCalledWith("proposal-1", {
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
    });

    // Activation omits paidAmountMinor (first invoice = activation + monthly).
    const activationArgs = mocks.confirmProposalPayment.mock.calls[0][0];
    expect(activationArgs.providerEventId).toBe("evt_1");
    expect(activationArgs.paidAmountMinor).toBeUndefined();

    expect(mocks.sendMembershipLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        externalSessionId: "session-1",
        externalProposalId: "proposal-1",
        externalSubscriptionId: "sub_1",
        externalEventId: "evt_1",
        eventKind: "activated",
        status: "active",
        currentPeriodEnd: PERIOD_END_ISO,
        monthlyAmountUsd: 69,
        created: CREATED,
      }),
    );
  });
});

describe("recurring invoice lifecycle", () => {
  beforeEach(() => {
    mocks.getProposalRequestBySub.mockResolvedValue(proposalFixture());
  });

  it("invoice.paid (subscription_cycle) → renewed/active", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_2",
      type: "invoice.paid",
      created: CREATED,
      data: {
        object: {
          billing_reason: "subscription_cycle",
          parent: { subscription_details: { subscription: "sub_1" } },
        },
      },
    });

    const res = await post();
    expect(res.status).toBe(200);
    expect(mocks.sendMembershipLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ eventKind: "renewed", status: "active", externalEventId: "evt_2" }),
    );
  });

  it("invoice.paid (subscription_create) → ignored, no forward", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_3",
      type: "invoice.paid",
      created: CREATED,
      data: {
        object: {
          billing_reason: "subscription_create",
          parent: { subscription_details: { subscription: "sub_1" } },
        },
      },
    });

    const res = await post();
    const body = await res.json();
    expect(body.ignored).toBe(true);
    expect(mocks.sendMembershipLifecycle).not.toHaveBeenCalled();
  });

  it("invoice.payment_failed → payment_failed/past_due", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_4",
      type: "invoice.payment_failed",
      created: CREATED,
      data: {
        object: { parent: { subscription_details: { subscription: "sub_1" } } },
      },
    });

    await post();
    expect(mocks.sendMembershipLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ eventKind: "payment_failed", status: "past_due" }),
    );
  });
});

describe("subscription object lifecycle", () => {
  beforeEach(() => {
    mocks.getProposalRequestBySub.mockResolvedValue(proposalFixture());
  });

  it("customer.subscription.updated maps the Stripe status (past_due)", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_5",
      type: "customer.subscription.updated",
      created: CREATED,
      data: { object: subscriptionFixture({ status: "past_due" }) },
    });

    await post();
    expect(mocks.sendMembershipLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ eventKind: "updated", status: "past_due", currentPeriodEnd: PERIOD_END_ISO }),
    );
    // updated/deleted carry the subscription on the event — no retrieve needed.
    expect(mocks.retrieveSubscription).not.toHaveBeenCalled();
  });

  it("customer.subscription.deleted → cancelled/ended", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_6",
      type: "customer.subscription.deleted",
      created: CREATED,
      data: { object: subscriptionFixture({ status: "canceled" }) },
    });

    await post();
    expect(mocks.sendMembershipLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ eventKind: "cancelled", status: "ended" }),
    );
  });
});

describe("guards", () => {
  it("ignores an unmapped subscription (no 5xx retry loop)", async () => {
    mocks.getProposalRequestBySub.mockResolvedValue(null);
    mocks.getProposalRequest.mockResolvedValue(null);
    mocks.constructEvent.mockReturnValue({
      id: "evt_7",
      type: "customer.subscription.updated",
      created: CREATED,
      data: { object: subscriptionFixture({ metadata: {} }) },
    });

    const res = await post();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ignored).toBe(true);
    expect(mocks.sendMembershipLifecycle).not.toHaveBeenCalled();
  });

  it("one-time checkout still routes to the existing activation (regression)", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_8",
      type: "checkout.session.completed",
      created: CREATED,
      data: {
        object: {
          id: "cs_ot",
          mode: "payment",
          payment_status: "paid",
          payment_intent: "pi_1",
          client_reference_id: "proposal-1",
          currency: "usd",
          amount_total: 450000,
          metadata: { external_proposal_id: "proposal-1", external_session_id: "session-1" },
        },
      },
    });
    mocks.confirmProposalPayment.mockResolvedValue({
      proposal: { ...proposalFixture(), status: "paid" },
      session: { id: "session-1" },
      workspace: { id: "ws_1" },
      paymentEvent: {},
      idempotent: false,
    });

    const res = await post();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.membership).toBeUndefined();
    expect(body.handled).toBe(true);
    // one-time path passes the strict paidAmountMinor.
    expect(mocks.confirmProposalPayment.mock.calls[0][0].paidAmountMinor).toBe(450000);
    expect(mocks.sendMembershipLifecycle).not.toHaveBeenCalled();
  });
});

describe("version-robustness fallbacks + metadata resolution + delivery", () => {
  it("reads current_period_end from the subscription top level when items omit it", async () => {
    // dahlia carries it per-item; older API versions exposed it at the top level.
    mocks.getProposalRequestBySub.mockResolvedValue(proposalFixture());
    mocks.constructEvent.mockReturnValue({
      id: "evt_9",
      type: "customer.subscription.updated",
      created: CREATED,
      data: {
        object: subscriptionFixture({
          status: "active",
          items: { data: [{}] },
          current_period_end: PERIOD_END_UNIX,
        }),
      },
    });

    await post();
    expect(mocks.sendMembershipLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ currentPeriodEnd: PERIOD_END_ISO }),
    );
  });

  it("reads the subscription id from the legacy top-level invoice.subscription", async () => {
    // dahlia nests it under invoice.parent.subscription_details.subscription;
    // older API versions exposed invoice.subscription at the top level.
    mocks.getProposalRequestBySub.mockResolvedValue(proposalFixture());
    mocks.constructEvent.mockReturnValue({
      id: "evt_10",
      type: "invoice.paid",
      created: CREATED,
      data: { object: { billing_reason: "subscription_cycle", subscription: "sub_1" } },
    });

    await post();
    expect(mocks.getProposalRequestBySub).toHaveBeenCalledWith("sub_1");
    expect(mocks.sendMembershipLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ eventKind: "renewed", externalSubscriptionId: "sub_1" }),
    );
  });

  it("falls back to subscription.metadata.external_proposal_id when no row maps the sub", async () => {
    // resolveMembershipProposal: bySub miss → metadata.external_proposal_id (set on
    // the subscription at checkout via subscription_data.metadata).
    mocks.getProposalRequestBySub.mockResolvedValue(null);
    mocks.getProposalRequest.mockResolvedValue(proposalFixture());
    mocks.constructEvent.mockReturnValue({
      id: "evt_11",
      type: "invoice.paid",
      created: CREATED,
      data: {
        object: {
          billing_reason: "subscription_cycle",
          parent: { subscription_details: { subscription: "sub_1" } },
        },
      },
    });

    await post();
    expect(mocks.getProposalRequest).toHaveBeenCalledWith("proposal-1");
    expect(mocks.sendMembershipLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ eventKind: "renewed", externalProposalId: "proposal-1" }),
    );
  });

  it("ignores an invoice.paid with an unsupported billing_reason", async () => {
    mocks.getProposalRequestBySub.mockResolvedValue(proposalFixture());
    mocks.constructEvent.mockReturnValue({
      id: "evt_12",
      type: "invoice.paid",
      created: CREATED,
      data: {
        object: {
          billing_reason: "subscription_update",
          parent: { subscription_details: { subscription: "sub_1" } },
        },
      },
    });

    const res = await post();
    const body = await res.json();
    expect(body.ignored).toBe(true);
    expect(mocks.sendMembershipLifecycle).not.toHaveBeenCalled();
  });

  it("propagates a forward failure as a non-2xx so Stripe re-delivers (at-least-once)", async () => {
    mocks.getProposalRequestBySub.mockResolvedValue(proposalFixture());
    mocks.sendMembershipLifecycle.mockRejectedValue(
      new NoonAppIntegrationError("App handoff failed", 502),
    );
    mocks.constructEvent.mockReturnValue({
      id: "evt_13",
      type: "invoice.paid",
      created: CREATED,
      data: {
        object: {
          billing_reason: "subscription_cycle",
          parent: { subscription_details: { subscription: "sub_1" } },
        },
      },
    });

    const res = await post();
    expect(res.status).toBe(502);
  });
});
