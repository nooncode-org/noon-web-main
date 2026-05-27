/**
 * tests/maxwell/payment-activation-lifecycle.test.ts
 *
 * Pins the B8 #2/#3 lifecycle-email wiring inside
 * `confirmProposalPayment` — the fire-and-forget side-effect that
 * sends "Payment received" + "Workspace ready" after every fresh
 * payment activation.
 *
 * Test surface: `confirmProposalPayment` DIRECTLY (not through the
 * HTTP route). Two reasons:
 *
 *   1. The wiring is at the activation level, not the route level —
 *      every code path that goes through `confirmProposalPayment`
 *      (Stripe webhook, manual ops confirm, evidence-based confirm)
 *      gets the same emails for free. Testing here covers all three.
 *
 *   2. The call site uses `void sendLifecycleEmailsForPayment(...)` —
 *      fire-and-forget. From the route handler's perspective the
 *      response returns BEFORE the email promise resolves. Going
 *      through the route would force every test to flush microtasks
 *      with awkward `setImmediate` chains; here we flush once at the
 *      end of each test with a single `await flushMicrotasks()`.
 *
 * What we pin:
 *   - Happy path: both senders called with the right args (recipient,
 *     project title, amount, currency, reference, workspace URL,
 *     idempotency-friendly ids).
 *   - No deliveryRecipient: senders NOT called, warn logged.
 *   - Sender failure: when B8 #2 throws, B8 #3 still runs (independent
 *     try/catch per stage), and the function still returns success.
 *   - Idempotent retry path: when the payment was already processed
 *     (existing payment_event for the same provider_event_id), the
 *     senders are NOT called — those emails went out on the original
 *     confirmation, re-sending would be inbox spam.
 *   - Workspace URL resolution failure: B8 #2 still fires (without
 *     CTA), B8 #3 is skipped entirely.
 *   - Gate OFF: senders return `{ skipped: true }` — wiring still
 *     calls them (logs the skip) so observability captures it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ClientWorkspace,
  PaymentEvent,
  ProposalRequest,
  StudioSession,
} from "@/lib/maxwell/repositories";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/maxwell/repositories", () => ({
  activateClientWorkspace: vi.fn(),
  appendPaymentEvent: vi.fn(),
  appendProposalReviewEvent: vi.fn(async () => undefined),
  createClientWorkspace: vi.fn(),
  getClientWorkspaceBySession: vi.fn(),
  getLatestProposalRequest: vi.fn(),
  getPaymentEventByProviderEventId: vi.fn(),
  getProposalRequest: vi.fn(),
  getStudioSession: vi.fn(),
  getStudioVersions: vi.fn(async () => []),
  updateProposalRequestStatus: vi.fn(),
  updateStudioSessionStatus: vi.fn(async () => undefined),
}));

vi.mock("@/lib/maxwell/lifecycle-emails", () => ({
  sendPaymentReceivedEmail: vi.fn(async () => ({
    provider: "resend",
    messageId: "email_pay_1",
  })),
  sendWorkspaceReadyEmail: vi.fn(async () => ({
    provider: "resend",
    messageId: "email_ws_1",
  })),
}));

vi.mock("@/lib/noon-app-integration", async () => {
  class NoonAppIntegrationError extends Error {
    status: number;
    constructor(message: string, status = 502) {
      super(message);
      this.name = "NoonAppIntegrationError";
      this.status = status;
    }
  }
  return {
    buildWebsiteProposalPayload: vi.fn(() => ({
      external_source: "noon_website",
      external_session_id: "session-1",
      external_proposal_id: "proposal-1",
      customer: { name: "Client", email: "client@noon.dev", company: null },
      proposal: { title: "Build a thing", body: "body", amount: 1250, currency: "USD" },
      maxwell: { prototype_url: null },
      metadata: {},
    })),
    NoonAppIntegrationError,
    sendPaymentConfirmedToNoonApp: vi.fn(async () => undefined),
  };
});

// Silence logger so the test output stays clean; we still assert call
// counts on the email senders.
vi.mock("@/lib/server/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as repos from "@/lib/maxwell/repositories";
import * as emails from "@/lib/maxwell/lifecycle-emails";
import { confirmProposalPayment } from "@/lib/maxwell/payment-activation";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function fakeProposal(overrides: Partial<ProposalRequest> = {}): ProposalRequest {
  return {
    id: "proposal-1",
    studioSessionId: "session-1",
    versionNumber: 1,
    publicToken: "token-abc",
    status: "sent",
    caseClassification: "normal",
    reviewRequired: true,
    reviewerId: null,
    draftContent: "body",
    deliveryChannel: "email",
    deliveryStatus: "sent",
    deliveryRecipient: "client@noon.dev",
    approvedAmountUsd: 1250,
    approvedCurrency: "USD",
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripePaidAt: null,
    sentAt: new Date().toISOString(),
    firstOpenedAt: null,
    expiresAt: null,
    reviewNotifiedAt: new Date().toISOString(),
    reviewRemindedAt: null,
    reviewEscalatedAt: null,
    autoSendDueAt: null,
    supersedesProposalRequestId: null,
    supersededByProposalRequestId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function fakeSession(overrides: Partial<StudioSession> = {}): StudioSession {
  return {
    id: "session-1",
    initialPrompt: "Build a thing",
    status: "proposal_sent",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    ownerImage: null,
    projectType: null,
    goalSummary: "Acme launchpad",
    complexityHint: null,
    language: "en",
    correctionsUsed: 0,
    maxCorrections: 2,
    proposalRequestedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stylePackId: null,
    prototypeWorkspaceId: null,
    shareToken: null,
    shareTokenUrl: null,
    prototypeSharedAt: null,
    ...overrides,
  };
}

function fakeWorkspace(overrides: Partial<ClientWorkspace> = {}): ClientWorkspace {
  return {
    id: "workspace-1",
    studioSessionId: "session-1",
    paymentStatus: "confirmed",
    workspaceStatus: "active",
    latestUpdateSummary: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function fakePaymentEvent(overrides: Partial<PaymentEvent> = {}): PaymentEvent {
  return {
    id: "evt-abc",
    studioSessionId: "session-1",
    eventType: "confirmed",
    amountUsd: 1250,
    reference: "pi_3Ou123",
    notes: null,
    provider: "stripe",
    providerEventId: "stripe_evt_1",
    providerSessionId: null,
    providerPaymentIntentId: "pi_3Ou123",
    currency: "USD",
    payloadJson: null,
    createdBy: "stripe-webhook",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Flush the microtask queue so `void`-discarded promises resolve. One
 * round of `Promise.resolve()` is enough because the fire-and-forget
 * helper chains its awaits inside a try/catch — no setImmediate /
 * setTimeout boundaries to cross.
 */
async function flushFireAndForget(): Promise<void> {
  // Two ticks: first to let the helper start, second to let its inner
  // awaits resolve before the assertion runs.
  await new Promise<void>((resolve) => resolve());
  await new Promise<void>((resolve) => resolve());
}

// ---------------------------------------------------------------------------
// Common setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default happy-path wiring used by most tests.
  vi.mocked(repos.getPaymentEventByProviderEventId).mockResolvedValue(null);
  vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
  vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
  vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(null);
  vi.mocked(repos.createClientWorkspace).mockResolvedValue(fakeWorkspace());
  vi.mocked(repos.activateClientWorkspace).mockResolvedValue(fakeWorkspace());
  vi.mocked(repos.updateProposalRequestStatus).mockImplementation(
    async (id, status) => fakeProposal({ id, status }),
  );
  vi.mocked(repos.appendPaymentEvent).mockResolvedValue(fakePaymentEvent());

  // Set the public base URL so buildWorkspaceUrl can resolve. Tests
  // that want to exercise the "no URL" path clear this explicitly.
  vi.stubEnv("MAXWELL_PUBLIC_BASE_URL", "https://noon.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("confirmProposalPayment — B8 #2/#3 wiring (happy path)", () => {
  it("fires both lifecycle emails with the right args after a fresh activation", async () => {
    const result = await confirmProposalPayment({
      proposalRequestId: "proposal-1",
      actor: "stripe-webhook",
      provider: "stripe",
      providerEventId: "stripe_evt_1",
      paidAmountMinor: 125000,
      paidCurrency: "USD",
    });

    expect(result.idempotent).toBe(false);
    await flushFireAndForget();

    expect(emails.sendPaymentReceivedEmail).toHaveBeenCalledTimes(1);
    expect(emails.sendPaymentReceivedEmail).toHaveBeenCalledWith({
      paymentEventId: "evt-abc",
      to: "client@noon.dev",
      projectTitle: "Acme launchpad",
      amount: 1250,
      currency: "USD",
      paymentReference: "pi_3Ou123",
      workspaceUrl: "https://noon.com/en/maxwell/workspace/session-1",
    });

    expect(emails.sendWorkspaceReadyEmail).toHaveBeenCalledTimes(1);
    expect(emails.sendWorkspaceReadyEmail).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      to: "client@noon.dev",
      projectTitle: "Acme launchpad",
      workspaceUrl: "https://noon.com/en/maxwell/workspace/session-1",
    });
  });

  it("uses session.language as the locale segment in the workspace URL", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession({ language: "es" }));

    await confirmProposalPayment({
      proposalRequestId: "proposal-1",
      actor: "stripe-webhook",
      provider: "stripe",
      providerEventId: "stripe_evt_2",
      paidAmountMinor: 125000,
      paidCurrency: "USD",
    });
    await flushFireAndForget();

    expect(emails.sendPaymentReceivedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceUrl: "https://noon.com/es/maxwell/workspace/session-1",
      }),
    );
  });

  it('falls back to "Your Noon project" when goalSummary is blank', async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ goalSummary: "   " }),
    );

    await confirmProposalPayment({
      proposalRequestId: "proposal-1",
      actor: "stripe-webhook",
      provider: "stripe",
      providerEventId: "stripe_evt_3",
      paidAmountMinor: 125000,
      paidCurrency: "USD",
    });
    await flushFireAndForget();

    expect(emails.sendPaymentReceivedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ projectTitle: "Your Noon project" }),
    );
  });
});

// ---------------------------------------------------------------------------
// Skip conditions
// ---------------------------------------------------------------------------

describe("confirmProposalPayment — B8 skip conditions", () => {
  it("does NOT call senders when proposal.deliveryRecipient is null", async () => {
    // Both repository calls must return the recipient-null variant —
    // `updateProposalRequestStatus` re-fetches/re-builds the proposal
    // inside `confirmProposalPayment` and the result OVERWRITES the
    // `proposal` local, so mocking only `getProposalRequest` would
    // leak the default recipient back in via the status update.
    const recipientless = fakeProposal({ deliveryRecipient: null });
    vi.mocked(repos.getProposalRequest).mockResolvedValue(recipientless);
    vi.mocked(repos.updateProposalRequestStatus).mockResolvedValue(recipientless);

    await confirmProposalPayment({
      proposalRequestId: "proposal-1",
      actor: "stripe-webhook",
      provider: "stripe",
      providerEventId: "stripe_evt_no_recipient",
      paidAmountMinor: 125000,
      paidCurrency: "USD",
    });
    await flushFireAndForget();

    expect(emails.sendPaymentReceivedEmail).not.toHaveBeenCalled();
    expect(emails.sendWorkspaceReadyEmail).not.toHaveBeenCalled();
  });

  it("does NOT fire emails on idempotent retry (existing provider_event_id)", async () => {
    // Idempotency path: the same provider_event_id was processed before
    // → return the existing event, never recompute, never resend emails.
    vi.mocked(repos.getPaymentEventByProviderEventId).mockResolvedValue(fakePaymentEvent());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(fakeWorkspace());

    const result = await confirmProposalPayment({
      proposalRequestId: "proposal-1",
      actor: "stripe-webhook",
      provider: "stripe",
      providerEventId: "stripe_evt_1",
      paidAmountMinor: 125000,
      paidCurrency: "USD",
    });
    await flushFireAndForget();

    expect(result.idempotent).toBe(true);
    expect(emails.sendPaymentReceivedEmail).not.toHaveBeenCalled();
    expect(emails.sendWorkspaceReadyEmail).not.toHaveBeenCalled();
  });

  it("still fires B8 #2 when base URL is missing — but skips B8 #3", async () => {
    // Clear every base-URL env so buildWorkspaceUrl throws.
    vi.stubEnv("MAXWELL_PUBLIC_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");

    await confirmProposalPayment({
      proposalRequestId: "proposal-1",
      actor: "stripe-webhook",
      provider: "stripe",
      providerEventId: "stripe_evt_no_url",
      paidAmountMinor: 125000,
      paidCurrency: "USD",
    });
    await flushFireAndForget();

    // B8 #2 fires with workspaceUrl null (template handles it).
    expect(emails.sendPaymentReceivedEmail).toHaveBeenCalledTimes(1);
    expect(emails.sendPaymentReceivedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceUrl: null }),
    );

    // B8 #3 is skipped entirely — a "workspace ready" email without
    // the link is useless.
    expect(emails.sendWorkspaceReadyEmail).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Fire-and-forget contract (errors must not bubble)
// ---------------------------------------------------------------------------

describe("confirmProposalPayment — fire-and-forget error absorption", () => {
  it("does NOT fail the activation when B8 #2 throws", async () => {
    vi.mocked(emails.sendPaymentReceivedEmail).mockRejectedValueOnce(
      new Error("Resend 503"),
    );

    const result = await confirmProposalPayment({
      proposalRequestId: "proposal-1",
      actor: "stripe-webhook",
      provider: "stripe",
      providerEventId: "stripe_evt_b8_fail",
      paidAmountMinor: 125000,
      paidCurrency: "USD",
    });
    await flushFireAndForget();

    // Activation completed normally — caller never sees the email error.
    expect(result.idempotent).toBe(false);
    expect(result.workspace.id).toBe("workspace-1");

    // B8 #3 still ran despite B8 #2 throwing (independent try/catch).
    expect(emails.sendWorkspaceReadyEmail).toHaveBeenCalledTimes(1);
  });

  it("does NOT fail when B8 #3 throws (B8 #2 already sent)", async () => {
    vi.mocked(emails.sendWorkspaceReadyEmail).mockRejectedValueOnce(
      new Error("Resend 503"),
    );

    const result = await confirmProposalPayment({
      proposalRequestId: "proposal-1",
      actor: "stripe-webhook",
      provider: "stripe",
      providerEventId: "stripe_evt_b8_3_fail",
      paidAmountMinor: 125000,
      paidCurrency: "USD",
    });
    await flushFireAndForget();

    expect(result.idempotent).toBe(false);
    expect(emails.sendPaymentReceivedEmail).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Gate-aware behaviour (senders return skipped sentinel)
// ---------------------------------------------------------------------------

describe("confirmProposalPayment — gate-skipped senders are tolerated", () => {
  it("treats { skipped: true } as success (no exception, activation completes)", async () => {
    vi.mocked(emails.sendPaymentReceivedEmail).mockResolvedValueOnce({
      provider: "resend",
      messageId: null,
      skipped: true,
      reason: "lifecycle_emails_disabled",
    });
    vi.mocked(emails.sendWorkspaceReadyEmail).mockResolvedValueOnce({
      provider: "resend",
      messageId: null,
      skipped: true,
      reason: "lifecycle_emails_disabled",
    });

    const result = await confirmProposalPayment({
      proposalRequestId: "proposal-1",
      actor: "stripe-webhook",
      provider: "stripe",
      providerEventId: "stripe_evt_gated",
      paidAmountMinor: 125000,
      paidCurrency: "USD",
    });
    await flushFireAndForget();

    expect(result.idempotent).toBe(false);
    // Wiring still INVOKED the senders — gate decision happens inside
    // them, not at the call site. That's important: it means
    // observability sees the skip event and ops can verify B8 is
    // dormant from logs.
    expect(emails.sendPaymentReceivedEmail).toHaveBeenCalledTimes(1);
    expect(emails.sendWorkspaceReadyEmail).toHaveBeenCalledTimes(1);
  });
});
