/**
 * tests/maxwell/noon-app-webhook.test.ts
 *
 * End-to-end tests for the inbound Noon App webhook
 * (`POST /api/integrations/noon-app/proposal-review-decision`).
 *
 * Repositories and public-url helper are mocked. The HMAC signature
 * verification, Zod schema parsing and route handler are exercised for real.
 *
 * Coverage matrix:
 *  - Signature: missing / invalid / outside clock skew / valid
 *  - Payload: malformed JSON / Zod failure / wrong external_source
 *  - Lookups: proposal not found / session not found / session mismatch
 *  - Decision branches: approved / changes_requested / rejected / cancelled
 *  - Idempotency: replay on already-applied decision
 *  - Draft update: only when body changed
 */

import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/maxwell/repositories", () => ({
  getProposalRequest: vi.fn(),
  getStudioSession: vi.fn(),
  updateProposalDraftContent: vi.fn(async () => undefined),
  updateProposalRequestStatus: vi.fn(async (id: string, status: string) => ({
    id,
    status,
  })),
  updateStudioSessionStatus: vi.fn(async () => undefined),
  appendProposalReviewEvent: vi.fn(async () => undefined),
  // W7 — PM note persisted into the studio chat on changes_requested.
  appendStudioMessage: vi.fn(async () => undefined),
  // §7.6 idempotency ledger (fresh key by default; tests override for replays).
  findReceivedProposalReviewDecision: vi.fn(async () => null),
  recordReceivedProposalReviewDecision: vi.fn(async () => undefined),
}));

vi.mock("@/lib/maxwell/public-url", () => ({
  buildPublicProposalUrl: vi.fn(
    (token: string) => `https://noon.test/en/maxwell/proposal/${token}`,
  ),
  buildStudioSessionUrl: vi.fn(
    (sessionId: string) => `https://noon.test/en/maxwell?session_id=${sessionId}`,
  ),
}));

// Mock the email senders so the receiver tests can assert which one fired
// without hitting Resend. The error classes are re-created locally because
// the route pattern-matches on them (`error instanceof ...`).
vi.mock("@/lib/maxwell/proposal-email", () => {
  class ProposalEmailConfigurationError extends Error {}
  class ProposalEmailSendError extends Error {}
  return {
    ProposalEmailConfigurationError,
    ProposalEmailSendError,
    sendProposalEmail: vi.fn(async () => ({
      provider: "resend",
      messageId: "email_approved",
    })),
    sendProposalRejectedEmail: vi.fn(async () => ({
      provider: "resend",
      messageId: "email_decline",
    })),
    sendProposalChangesRequestedEmail: vi.fn(async () => ({
      provider: "resend",
      messageId: "email_changes",
    })),
  };
});

import * as repos from "@/lib/maxwell/repositories";
import {
  sendProposalChangesRequestedEmail,
  sendProposalEmail,
  sendProposalRejectedEmail,
} from "@/lib/maxwell/proposal-email";
import type { ProposalRequest, StudioSession } from "@/lib/maxwell/repositories";
import { POST } from "@/app/api/integrations/noon-app/proposal-review-decision/route";

const TEST_SECRET = "test-secret-not-for-prod";
const ROUTE_URL =
  "http://localhost/api/integrations/noon-app/proposal-review-decision";

const basePayload = {
  event: "proposal_review_decision",
  external_source: "noon_website",
  external_session_id: "session-1",
  external_proposal_id: "proposal-1",
  proposal: {
    title: "Project X",
    body: "Approved proposal body",
    amount: 4500,
    currency: "USD",
    review_status: "approved",
  },
};

function buildSignedRequest(
  body: unknown,
  opts: {
    secret?: string;
    timestamp?: number;
    signature?: string;
    omitSignature?: boolean;
    omitTimestamp?: boolean;
    bodyOverride?: string;
    idempotencyKey?: string;
  } = {},
): Request {
  const bodyText = opts.bodyOverride ?? JSON.stringify(body);
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const secret = opts.secret ?? TEST_SECRET;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${bodyText}`)
    .digest("hex");
  const signature = opts.signature ?? `sha256=${computed}`;

  const headers = new Headers({ "content-type": "application/json" });
  if (!opts.omitSignature) headers.set("x-noon-signature", signature);
  if (!opts.omitTimestamp) headers.set("x-noon-timestamp", String(timestamp));
  if (opts.idempotencyKey) headers.set("x-noon-idempotency-key", opts.idempotencyKey);

  return new Request(ROUTE_URL, { method: "POST", headers, body: bodyText });
}

function fakeProposal(overrides: Partial<ProposalRequest> = {}): ProposalRequest {
  return {
    id: "proposal-1",
    studioSessionId: "session-1",
    versionNumber: 1,
    publicToken: "public-token-abc",
    status: "pending_review",
    caseClassification: "normal",
    reviewRequired: true,
    reviewerId: null,
    draftContent: "Approved proposal body",
    deliveryChannel: "email",
    deliveryStatus: "pending_review",
    deliveryRecipient: "owner@noon.dev",
    approvedAmountUsd: null,
    approvedCurrency: null,
    paymentModality: null,
    monthlyAmountUsd: null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    stripePaidAt: null,
    sentAt: null,
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
    status: "proposal_pending_review",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    ownerImage: null,
    projectType: null,
    goalSummary: null,
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

beforeEach(() => {
  vi.stubEnv("NOON_WEBSITE_WEBHOOK_SECRET", TEST_SECRET);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ============================================================================
// Signature verification
// ============================================================================

describe("Noon App webhook — signature verification", () => {
  it("returns 401 when the signature header is missing", async () => {
    const req = buildSignedRequest({ ...basePayload, decision: "approved" }, {
      omitSignature: true,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the signature does not match the body", async () => {
    const req = buildSignedRequest(
      { ...basePayload, decision: "approved" },
      { signature: `sha256=${"0".repeat(64)}` },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signed with a different secret (forged signature)", async () => {
    const req = buildSignedRequest(
      { ...basePayload, decision: "approved" },
      { secret: "wrong-secret" },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the timestamp is outside the 5-minute window", async () => {
    const req = buildSignedRequest(
      { ...basePayload, decision: "approved" },
      { timestamp: Math.floor(Date.now() / 1000) - 6 * 60 },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the timestamp is not numeric", async () => {
    // Build a body+sig pair, then override the timestamp header with garbage.
    // The route reads the header before validating the signature against it,
    // so a non-numeric timestamp must short-circuit to 401.
    const bodyText = JSON.stringify({ ...basePayload, decision: "approved" });
    const validTs = Math.floor(Date.now() / 1000);
    const sig = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${validTs}.${bodyText}`)
      .digest("hex");

    const headers = new Headers({
      "content-type": "application/json",
      "x-noon-signature": `sha256=${sig}`,
      "x-noon-timestamp": "not-a-number",
    });

    const req = new Request(ROUTE_URL, { method: "POST", headers, body: bodyText });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the body is altered after signing (tamper)", async () => {
    const originalBody = JSON.stringify({ ...basePayload, decision: "approved" });
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${timestamp}.${originalBody}`)
      .digest("hex");

    const tamperedBody = originalBody.replace(
      "Approved proposal body",
      "Tampered body",
    );

    const headers = new Headers({
      "content-type": "application/json",
      "x-noon-signature": `sha256=${sig}`,
      "x-noon-timestamp": String(timestamp),
    });

    const req = new Request(ROUTE_URL, { method: "POST", headers, body: tamperedBody });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("F-1 regression: returns 401 when x-noon-timestamp header is missing (mirror App 92f1e0b)", async () => {
    // Attack vector replicado de B1.3b Scenario 3d (App side):
    // signature válida computada sobre `${timestamp}.${bodyText}` pero el
    // header x-noon-timestamp se omite. Antes del fix F-1, el verifier caía
    // en la rama `else` del ternario y firmaba solo `bodyText`, bypaseando
    // el anti-replay window ±5min. Tras el fix, debe rechazarse con 401.
    const req = buildSignedRequest(
      { ...basePayload, decision: "approved" },
      { omitTimestamp: true },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.message).toBe("Missing Noon App timestamp.");
  });
});

// ============================================================================
// Payload validation
// ============================================================================

describe("Noon App webhook — payload validation", () => {
  it("returns 400 when the JSON is malformed", async () => {
    const bodyText = "{ not valid json";
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${timestamp}.${bodyText}`)
      .digest("hex");

    const headers = new Headers({
      "content-type": "application/json",
      "x-noon-signature": `sha256=${sig}`,
      "x-noon-timestamp": String(timestamp),
    });
    const req = new Request(ROUTE_URL, { method: "POST", headers, body: bodyText });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing (Zod failure)", async () => {
    const req = buildSignedRequest({
      event: "proposal_review_decision",
      decision: "approved",
      // missing external_source / external_session_id / external_proposal_id / proposal
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when external_source is not noon_website", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({
      ...basePayload,
      decision: "approved",
      external_source: "some_other_system",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(repos.getProposalRequest).not.toHaveBeenCalled();
  });

  it("rejects unknown decision values via Zod", async () => {
    const req = buildSignedRequest({ ...basePayload, decision: "totally-fake" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// Domain lookups
// ============================================================================

describe("Noon App webhook — domain lookups", () => {
  it("returns 404 when the proposal is not found", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(null);

    const req = buildSignedRequest({ ...basePayload, decision: "approved" });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 409 when proposal does not belong to the claimed session", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(
      fakeProposal({ studioSessionId: "different-session" }),
    );

    const req = buildSignedRequest({ ...basePayload, decision: "approved" });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 404 when the studio session is not found", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(null);

    const req = buildSignedRequest({ ...basePayload, decision: "approved" });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// Approved decision
// ============================================================================

describe("Noon App webhook — approved decision", () => {
  it("marks proposal as sent, session as proposal_sent, returns the public URL", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({ ...basePayload, decision: "approved" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.decision).toBe("approved");
    expect(body.session_status).toBe("proposal_sent");
    expect(body.public_url).toBe(
      "https://noon.test/en/maxwell/proposal/public-token-abc",
    );

    expect(repos.updateProposalRequestStatus).toHaveBeenCalledWith(
      "proposal-1",
      "sent",
      expect.objectContaining({
        reviewerId: "noon-app",
        deliveryStatus: "sent",
        deliveryRecipient: "owner@noon.dev",
        approvedAmountUsd: 4500,
        approvedCurrency: "USD",
      }),
    );
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith(
      "session-1",
      "proposal_sent",
    );
    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalRequestId: "proposal-1",
        action: "noon_app_approved",
        actor: "noon-app",
      }),
    );
  });

  it("does NOT update draft when the body has not changed", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(
      fakeProposal({ draftContent: "Approved proposal body" }),
    );
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({ ...basePayload, decision: "approved" });
    await POST(req);

    expect(repos.updateProposalDraftContent).not.toHaveBeenCalled();
  });

  it("DOES update draft when the body has changed", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(
      fakeProposal({ draftContent: "Old body" }),
    );
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({ ...basePayload, decision: "approved" });
    await POST(req);

    expect(repos.updateProposalDraftContent).toHaveBeenCalledWith(
      "proposal-1",
      "Approved proposal body",
    );
  });

  it("is idempotent when the proposal is already in a public status (replay)", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(
      fakeProposal({ status: "sent", approvedAmountUsd: 4500, approvedCurrency: "USD" }),
    );
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ status: "proposal_sent" }),
    );

    const req = buildSignedRequest({ ...basePayload, decision: "approved" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.message).toMatch(/already applied/i);
    expect(repos.updateProposalRequestStatus).not.toHaveBeenCalled();
    expect(repos.updateStudioSessionStatus).not.toHaveBeenCalled();
  });

  it("rejects approved decisions without a positive USD amount", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({
      ...basePayload,
      decision: "approved",
      proposal: { ...basePayload.proposal, amount: 0, currency: "USD" },
    });
    const res = await POST(req);

    expect(res.status).toBe(422);
    expect(repos.updateProposalRequestStatus).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Changes requested decision
// ============================================================================

describe("Noon App webhook — changes_requested decision", () => {
  it("marks proposal as returned and session back to approved_for_proposal", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({
      ...basePayload,
      decision: "changes_requested",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.session_status).toBe("approved_for_proposal");

    expect(repos.updateProposalRequestStatus).toHaveBeenCalledWith(
      "proposal-1",
      "returned",
      expect.objectContaining({ reviewerId: "noon-app" }),
    );
    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "noon_app_changes_requested" }),
    );
  });

  it("is idempotent when proposal is already in 'returned'", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(
      fakeProposal({ status: "returned" }),
    );
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({
      ...basePayload,
      decision: "changes_requested",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(repos.updateProposalRequestStatus).not.toHaveBeenCalled();
    // W7 — the early return also guards the chat message and the email.
    expect(repos.appendStudioMessage).not.toHaveBeenCalled();
    expect(sendProposalChangesRequestedEmail).not.toHaveBeenCalled();
  });

  it("W7: persists the PM note VERBATIM in the studio chat and forwards it to the email", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({
      ...basePayload,
      decision: "changes_requested",
      notes: "Add a pricing section and clarify the timeline.",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(repos.appendStudioMessage).toHaveBeenCalledTimes(1);
    expect(repos.appendStudioMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        studioSessionId: "session-1",
        role: "assistant",
        messageType: "system_event",
        content: expect.stringContaining("Add a pricing section and clarify the timeline."),
      }),
    );
    expect(sendProposalChangesRequestedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        pmNotes: "Add a pricing section and clarify the timeline.",
      }),
    );
  });

  it("W7: no notes (cron-rebuilt retry sends null) → no chat message, email gets pmNotes null", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({
      ...basePayload,
      decision: "changes_requested",
      notes: null,
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(repos.appendStudioMessage).not.toHaveBeenCalled();
    expect(sendProposalChangesRequestedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ pmNotes: null }),
    );
  });

  it("W7: a malformed notes value degrades to null instead of failing the decision", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({
      ...basePayload,
      decision: "changes_requested",
      notes: "x".repeat(3000),
    });
    const res = await POST(req);

    // Nothing load-bearing keys off notes: the decision still applies.
    expect(res.status).toBe(200);
    expect(repos.updateProposalRequestStatus).toHaveBeenCalledWith(
      "proposal-1",
      "returned",
      expect.objectContaining({ reviewerId: "noon-app" }),
    );
    expect(repos.appendStudioMessage).not.toHaveBeenCalled();
  });

  it("W7: a failed chat-message insert does not block the 200 / decision", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
    vi.mocked(repos.appendStudioMessage).mockRejectedValueOnce(
      new Error("db exploded"),
    );

    const req = buildSignedRequest({
      ...basePayload,
      decision: "changes_requested",
      notes: "Add a pricing section.",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(sendProposalChangesRequestedEmail).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Rejected / cancelled decisions
// ============================================================================

describe("Noon App webhook — rejected / cancelled decisions", () => {
  it("marks proposal as expired with action noon_app_rejected", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({ ...basePayload, decision: "rejected" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(repos.updateProposalRequestStatus).toHaveBeenCalledWith(
      "proposal-1",
      "expired",
      expect.objectContaining({ reviewerId: "noon-app" }),
    );
    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "noon_app_rejected" }),
    );
  });

  it("marks proposal as expired with action noon_app_cancelled", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({ ...basePayload, decision: "cancelled" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "noon_app_cancelled" }),
    );
  });

  it("is idempotent when proposal is already 'expired'", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(
      fakeProposal({ status: "expired" }),
    );
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({ ...basePayload, decision: "rejected" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(repos.updateProposalRequestStatus).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Decline emails on rejected / cancelled (handoff 2026-05-29, Decision A/B)
// ============================================================================

describe("Noon App webhook — decline emails", () => {
  it("sends ONE decline email on 'rejected' and audits it as delivered", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({ ...basePayload, decision: "rejected" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(sendProposalRejectedEmail).toHaveBeenCalledTimes(1);
    expect(sendProposalRejectedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: "proposal-1",
        to: "owner@noon.dev",
        // session.goalSummary is null, so it falls back to initialPrompt.
        projectTitle: "Build a thing",
      }),
    );
    // changes_requested / approved sender must NOT fire on a rejection.
    expect(sendProposalEmail).not.toHaveBeenCalled();
    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "sent", actor: "noon-app" }),
    );
  });

  it("sends the SAME decline email on 'cancelled' (Decision B)", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({ ...basePayload, decision: "cancelled" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(sendProposalRejectedEmail).toHaveBeenCalledTimes(1);
  });

  it("sends ONLY the changes-requested email on 'changes_requested' (W3 supersedes Decision A)", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({
      ...basePayload,
      decision: "changes_requested",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(sendProposalChangesRequestedEmail).toHaveBeenCalledTimes(1);
    expect(sendProposalRejectedEmail).not.toHaveBeenCalled();
    expect(sendProposalEmail).not.toHaveBeenCalled();
  });

  it("does NOT block the 200 / status transition when the email fails", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
    vi.mocked(sendProposalRejectedEmail).mockRejectedValueOnce(
      new Error("resend exploded"),
    );

    const req = buildSignedRequest({ ...basePayload, decision: "rejected" });
    const res = await POST(req);

    // The decision still applied and the response is still 200.
    expect(res.status).toBe(200);
    expect(repos.updateProposalRequestStatus).toHaveBeenCalledWith(
      "proposal-1",
      "expired",
      expect.objectContaining({ reviewerId: "noon-app" }),
    );
    // The failure is recorded as a delivery_failed audit event, not swallowed.
    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delivery_failed", actor: "noon-app" }),
    );
  });

  it("skips the email and audits delivery_failed when no recipient resolves", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(
      fakeProposal({ deliveryRecipient: null }),
    );
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ ownerEmail: "" }),
    );

    const req = buildSignedRequest({ ...basePayload, decision: "rejected" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(sendProposalRejectedEmail).not.toHaveBeenCalled();
    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delivery_failed", actor: "noon-app" }),
    );
  });

  it("does NOT re-send on replay of an already-'expired' proposal", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(
      fakeProposal({ status: "expired" }),
    );
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({ ...basePayload, decision: "rejected" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(sendProposalRejectedEmail).not.toHaveBeenCalled();
  });
});

// ============================================================================
// §7.6 idempotency-key dedupe (cross-repo-webhook-v1.md — receiver-side ledger)
// ============================================================================

describe("Noon App webhook — §7.6 idempotency-key dedupe", () => {
  it("replays the recorded response body on a duplicate key WITHOUT touching state or emails", async () => {
    const recorded = {
      message: "Proposal approved by Noon App and published on website.",
      decision: "approved",
      public_url: "https://noon.test/en/maxwell/proposal/public-token-abc",
    };
    vi.mocked(repos.findReceivedProposalReviewDecision).mockResolvedValueOnce({
      responseBody: recorded,
    });

    const req = buildSignedRequest(
      { ...basePayload, decision: "approved" },
      { idempotencyKey: "proposal-1:approved" },
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(recorded);
    // The handler NEVER ran: no lookups, no transitions, no emails.
    expect(repos.getProposalRequest).not.toHaveBeenCalled();
    expect(repos.updateProposalRequestStatus).not.toHaveBeenCalled();
    expect(sendProposalEmail).not.toHaveBeenCalled();
    expect(sendProposalRejectedEmail).not.toHaveBeenCalled();
    expect(repos.recordReceivedProposalReviewDecision).not.toHaveBeenCalled();
  });

  it("records the response body under the key after a fresh successful processing", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest(
      { ...basePayload, decision: "approved" },
      { idempotencyKey: "proposal-1:approved" },
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(repos.findReceivedProposalReviewDecision).toHaveBeenCalledWith("proposal-1:approved");
    expect(repos.recordReceivedProposalReviewDecision).toHaveBeenCalledTimes(1);
    const recordArgs = vi.mocked(repos.recordReceivedProposalReviewDecision).mock.calls[0][0];
    expect(recordArgs.idempotencyKey).toBe("proposal-1:approved");
    expect(recordArgs.externalProposalId).toBe("proposal-1");
    expect(recordArgs.decision).toBe("approved");
    // The recorded body is the actual response body (replayable verbatim).
    expect(recordArgs.responseBody).toEqual(await res.json());
  });

  it("does NOT record a non-2xx outcome (the App must stay able to retry / dead-letter)", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(null); // → 404

    const req = buildSignedRequest(
      { ...basePayload, decision: "approved" },
      { idempotencyKey: "proposal-1:approved" },
    );
    const res = await POST(req);

    expect(res.status).toBe(404);
    expect(repos.recordReceivedProposalReviewDecision).not.toHaveBeenCalled();
  });

  it("a key that does not match the signed payload is ignored (processed without dedupe)", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest(
      { ...basePayload, decision: "approved" },
      { idempotencyKey: "OTHER-proposal:approved" },
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    // Never consulted nor recorded — the mismatched key can't poison the ledger.
    expect(repos.findReceivedProposalReviewDecision).not.toHaveBeenCalled();
    expect(repos.recordReceivedProposalReviewDecision).not.toHaveBeenCalled();
    // But the decision itself processed normally.
    expect(repos.updateProposalRequestStatus).toHaveBeenCalled();
  });

  it("a missing header (pre-G23 sender) processes exactly as before, without dedupe", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());

    const req = buildSignedRequest({ ...basePayload, decision: "approved" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(repos.findReceivedProposalReviewDecision).not.toHaveBeenCalled();
    expect(repos.recordReceivedProposalReviewDecision).not.toHaveBeenCalled();
  });

  it("a failed ledger record is swallowed — the applied decision still returns its 200 (best-effort)", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
    vi.mocked(repos.recordReceivedProposalReviewDecision).mockRejectedValueOnce(
      new Error("db down"),
    );

    const req = buildSignedRequest(
      { ...basePayload, decision: "approved" },
      { idempotencyKey: "proposal-1:approved" },
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect((await res.json()).decision).toBe("approved");
  });
});
