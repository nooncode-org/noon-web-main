import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isNoonAppProposalHandoffConfigured,
  noonAppProposalReviewDecisionPayloadSchema,
  sendInboundProposalToNoonApp,
} from "@/lib/noon-app-integration";
import type { ProposalRequest, StudioSession, StudioVersion } from "@/lib/maxwell/repositories";

const basePayload = {
  event: "proposal_review_decision",
  external_source: "noon_website",
  external_session_id: "session-1",
  external_proposal_id: "proposal-1",
  proposal: {
    title: "Website project",
    body: "Approved proposal body",
    amount: 4500,
    currency: "USD",
    review_status: "approved",
  },
};

describe("Noon App review decision payload", () => {
  it.each(["approved", "changes_requested", "rejected", "cancelled"])(
    "accepts the %s decision",
    (decision) => {
      const parsed = noonAppProposalReviewDecisionPayloadSchema.parse({
        ...basePayload,
        decision,
      });

      expect(parsed.decision).toBe(decision);
    },
  );

  it("rejects the old approval-only event contract", () => {
    expect(() =>
      noonAppProposalReviewDecisionPayloadSchema.parse({
        ...basePayload,
        event: "proposal_approved",
        decision: "approved",
      }),
    ).toThrow();
  });
});

/**
 * Cross-repo secret migration (NOON_APP_WEBHOOK_SECRET → NOON_WEBSITE_WEBHOOK_SECRET).
 *
 * Per `App-nooncode/docs/integrations/cross-repo-webhook-v1.md`, the canonical name on
 * both sides is `NOON_WEBSITE_WEBHOOK_SECRET`. Web historically used `NOON_APP_WEBHOOK_SECRET`;
 * that legacy fallback was removed on 2026-05-25 after both repos finished the rename.
 */
describe("isNoonAppProposalHandoffConfigured — secret name", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NOON_WEBSITE_WEBHOOK_SECRET;
    delete process.env.NOON_APP_WEBHOOK_SECRET;
    delete process.env.NOON_APP_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns false when neither secret nor base URL is configured", () => {
    expect(isNoonAppProposalHandoffConfigured()).toBe(false);
  });

  it("returns false when only the base URL is configured", () => {
    process.env.NOON_APP_BASE_URL = "https://noon-app.example.com";
    expect(isNoonAppProposalHandoffConfigured()).toBe(false);
  });

  it("returns false when only a secret is configured (no base URL)", () => {
    process.env.NOON_WEBSITE_WEBHOOK_SECRET = "shared-secret";
    expect(isNoonAppProposalHandoffConfigured()).toBe(false);
  });

  it("returns true when canonical NOON_WEBSITE_WEBHOOK_SECRET + base URL are set", () => {
    process.env.NOON_WEBSITE_WEBHOOK_SECRET = "shared-secret";
    process.env.NOON_APP_BASE_URL = "https://noon-app.example.com";
    expect(isNoonAppProposalHandoffConfigured()).toBe(true);
  });

  it("returns false when only the legacy NOON_APP_WEBHOOK_SECRET + base URL are set (legacy no longer accepted post 2026-05-25)", () => {
    process.env.NOON_APP_WEBHOOK_SECRET = "legacy-shared-secret";
    process.env.NOON_APP_BASE_URL = "https://noon-app.example.com";
    expect(isNoonAppProposalHandoffConfigured()).toBe(false);
  });

  it("treats whitespace-only values as missing", () => {
    process.env.NOON_WEBSITE_WEBHOOK_SECRET = "   ";
    process.env.NOON_APP_BASE_URL = "https://noon-app.example.com";
    expect(isNoonAppProposalHandoffConfigured()).toBe(false);
  });
});

/**
 * B9 — retry / backoff for postNoonAppWebhook.
 *
 * Tests exercise the retry policy by mocking global.fetch. Backoff timers are short
 * (1s base) so vi.useFakeTimers() keeps tests fast and deterministic.
 */
describe("postNoonAppWebhook — retry / backoff", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  // Fixtures use `as unknown as X` because the production types carry extra fields the
  // retry path never reads. The full ProposalRequest / StudioSession shapes are tested
  // elsewhere (tests/maxwell/payment.test.ts uses real fakes); here we only need the
  // minimum that `buildWebsiteProposalPayload` references.
  function fakeSession(): StudioSession {
    return {
      id: "session-1",
      initialPrompt: "Build me a thing",
      status: "approved_for_proposal",
      ownerEmail: "owner@example.com",
      ownerName: "Owner",
      ownerImage: null,
      projectType: null,
      goalSummary: "A thing",
      complexityHint: null,
      language: "en",
      correctionsUsed: 0,
      maxCorrections: 3,
      proposalRequestedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as StudioSession;
  }

  function fakeProposal(): ProposalRequest {
    return {
      id: "proposal-1",
      studioSessionId: "session-1",
      status: "pending_review",
      publicToken: "token-1",
      draftContent: "Draft body",
      caseClassification: null,
      versionNumber: 1,
      reviewerId: null,
      sentAt: null,
      firstOpenedAt: null,
      expiresAt: null,
      reviewRemindedAt: null,
      reviewEscalatedAt: null,
      deliveryRecipient: "owner@example.com",
      deliveryStatus: null,
      deliveryError: null,
      approvedAmountUsd: 4500,
      approvedCurrency: "USD",
      paymentModality: null,
      monthlyAmountUsd: null,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripePaidAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as ProposalRequest;
  }

  function okResponse(): Response {
    return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } });
  }

  function errorResponse(status: number, body = "down"): Response {
    return new Response(body, { status });
  }

  beforeEach(() => {
    process.env.NOON_WEBSITE_WEBHOOK_SECRET = "test-secret";
    process.env.NOON_APP_BASE_URL = "https://noon-app.test";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  /**
   * Helper that kicks off the send and drains the backoff timers. Returns the in-flight
   * promise so tests can assert on resolve / reject. We intentionally attach a no-op
   * `.catch(() => {})` on a *clone* before draining timers so that a rejection during
   * `runAllTimersAsync()` does not surface as an "unhandled rejection" warning — the
   * actual assertion is still made against the original promise via `expect(...).rejects`.
   */
  async function runSend(): Promise<unknown> {
    const promise = sendInboundProposalToNoonApp({
      session: fakeSession(),
      proposal: fakeProposal(),
      versions: [] as StudioVersion[],
    });
    // Silence unhandled-rejection warnings while timers drain; the real assertion is
    // attached by the caller via `expect(promise).rejects` if applicable.
    promise.catch(() => {});
    // Drain backoff timers (max 2 waits at 1s and 2s).
    await vi.runAllTimersAsync();
    return promise;
  }

  it("returns immediately on first attempt success (no retry)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(okResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    await runSend();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 500 and succeeds on second attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(okResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    await runSend();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on network errors (fetch throws) and succeeds on retry", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(okResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    await runSend();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 total attempts on persistent 5xx and throws", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(errorResponse(503));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(runSend()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry on 4xx (deterministic failure) and throws on first hit", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(errorResponse(401, "Unauthorized"));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(runSend()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 422 validation errors", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(errorResponse(422, "schema invalid"));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(runSend()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
