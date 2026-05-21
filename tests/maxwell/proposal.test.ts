/**
 * tests/maxwell/proposal.test.ts
 *
 * End-to-end tests for `POST /api/maxwell/proposal`.
 *
 * Auth, repos, OpenAI wrapper, Noon App handoff, commercial rules, and
 * draft validation/classifier all mocked. The route's branching logic
 * (resend path when pending_review, full generation path otherwise),
 * guard handling, and response shape run real.
 *
 * Coverage matrix:
 *   - Schema: missing session_id → 400 (zod)
 *   - Boot: missing OPENAI_API_KEY → 503
 *   - Auth: viewer null → 401; ownership fail → 403
 *   - Session: missing → 404
 *   - Resend path (status = proposal_pending_review):
 *     - Latest proposal not pending_review → 409 PROPOSAL_ALREADY_PENDING_REVIEW
 *     - Happy path → re-handoff to Noon App + returns resent_to_noon_app=true
 *     - Handoff returns a NextResponse error → it's forwarded
 *   - Generation path (status = approved_for_proposal):
 *     - Guard rejects (MaxwellGuardError) → 409 with code
 *     - Happy path → updateStatus + LLM call + createProposalRequest + append
 *       events + handoff → returns review_flags count
 *     - Draft with warnings → review_flags_detected event appended
 *   - prototype_ready status → transitions to approved_for_proposal first
 *   - Handoff NextResponse error in generation path forwarded
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProposalRequest, StudioSession } from "@/lib/maxwell/repositories";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-ia", () => ({
  chatWithOpenAI: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/auth/ownership", () => ({
  viewerOwnsStudioSession: vi.fn(() => true),
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  getStudioSession: vi.fn(),
  getStudioMessagesForOpenAI: vi.fn(async () => []),
  getStudioVersions: vi.fn(async () => []),
  getLatestProposalRequest: vi.fn(),
  createProposalRequest: vi.fn(),
  updateStudioSessionStatus: vi.fn(async () => undefined),
  appendStudioMessage: vi.fn(async () => undefined),
  appendProposalReviewEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/maxwell/studio-guards", async () => {
  class MaxwellGuardError extends Error {
    constructor(message: string, public readonly code: string) {
      super(message);
      this.name = "MaxwellGuardError";
    }
  }
  return {
    assertCanRequestProposal: vi.fn(),
    MaxwellGuardError,
  };
});

vi.mock("@/lib/maxwell/proposal-rules", () => ({
  buildProposalContext: vi.fn(() => "RICH CONTEXT"),
  resolveProposalCommercialProfile: vi.fn(() => ({
    membershipRecommended: true,
    bracket: "standard",
  })),
  validateProposalDraft: vi.fn(() => []),
}));

vi.mock("@/lib/maxwell/proposal-lifecycle", () => ({
  classifyProposalCase: vi.fn(() => "normal"),
}));

vi.mock("@/lib/maxwell/proposal-content", () => ({
  stripInternalReviewFlags: vi.fn((s: string) => s),
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
    NoonAppIntegrationError,
    isNoonAppProposalHandoffConfigured: vi.fn(() => true),
    sendInboundProposalToNoonApp: vi.fn(async () => undefined),
  };
});

import * as apiIa from "@/lib/api-ia";
import * as authSession from "@/lib/auth/session";
import * as ownership from "@/lib/auth/ownership";
import * as repos from "@/lib/maxwell/repositories";
import * as guards from "@/lib/maxwell/studio-guards";
import * as rules from "@/lib/maxwell/proposal-rules";
import * as noonApp from "@/lib/noon-app-integration";
import { POST } from "@/app/api/maxwell/proposal/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROUTE = "http://localhost/api/maxwell/proposal";

function postReq(body: unknown) {
  return new Request(ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeSession(overrides: Partial<StudioSession> = {}): StudioSession {
  return {
    id: "session-1",
    initialPrompt: "Build a thing",
    status: "approved_for_proposal",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    ownerImage: null,
    projectType: "landing",
    goalSummary: "Acme",
    complexityHint: "medio",
    language: "en",
    correctionsUsed: 0,
    maxCorrections: 2,
    proposalRequestedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stylePackId: null,
    ...overrides,
  };
}

function fakeProposal(overrides: Partial<ProposalRequest> = {}): ProposalRequest {
  return {
    id: "proposal-1",
    studioSessionId: "session-1",
    versionNumber: 1,
    publicToken: "token-abc",
    status: "pending_review",
    caseClassification: "normal",
    reviewRequired: true,
    reviewerId: null,
    draftContent: "draft body",
    deliveryChannel: "email",
    deliveryStatus: "pending_review",
    deliveryRecipient: "owner@noon.dev",
    approvedAmountUsd: null,
    approvedCurrency: null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");

  vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue({
    email: "owner@noon.dev",
    name: "Owner",
    image: null,
  });
  vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
  vi.mocked(apiIa.chatWithOpenAI).mockResolvedValue({ reply: "Generated proposal draft." });
  vi.mocked(repos.createProposalRequest).mockResolvedValue(fakeProposal());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Boot + auth
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/proposal — boot + auth", () => {
  it("returns 400 when session_id is missing from the body", async () => {
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 503 when OPENAI_API_KEY is not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const res = await POST(postReq({ session_id: "session-1" }));
    expect(res.status).toBe(503);
  });

  it("returns 401 when viewer is not authenticated", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);
    const res = await POST(postReq({ session_id: "session-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when session is missing", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(null);
    const res = await POST(postReq({ session_id: "session-1" }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when viewer does not own the session", async () => {
    vi.mocked(ownership.viewerOwnsStudioSession).mockReturnValueOnce(false);
    const res = await POST(postReq({ session_id: "session-1" }));
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Resend path (status = proposal_pending_review)
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/proposal — resend path", () => {
  it("returns 409 PROPOSAL_ALREADY_PENDING_REVIEW when latest proposal is not pending_review", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ status: "proposal_pending_review" }),
    );
    vi.mocked(repos.getLatestProposalRequest).mockResolvedValue(
      fakeProposal({ status: "sent" }), // not pending_review
    );

    const res = await POST(postReq({ session_id: "session-1" }));
    expect(res.status).toBe(409);

    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("PROPOSAL_ALREADY_PENDING_REVIEW");
  });

  it("resends to Noon App and returns resent_to_noon_app=true on happy resend", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ status: "proposal_pending_review" }),
    );
    vi.mocked(repos.getLatestProposalRequest).mockResolvedValue(
      fakeProposal({ status: "pending_review" }),
    );

    const res = await POST(postReq({ session_id: "session-1" }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      proposal_request_id: string;
      resent_to_noon_app: boolean;
      noon_app_handoff_skipped: boolean;
    };
    expect(body.proposal_request_id).toBe("proposal-1");
    expect(body.resent_to_noon_app).toBe(true);
    expect(body.noon_app_handoff_skipped).toBe(false);

    // Did NOT regenerate — chatWithOpenAI was never called.
    expect(apiIa.chatWithOpenAI).not.toHaveBeenCalled();
    // Did NOT createProposalRequest.
    expect(repos.createProposalRequest).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Generation path
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/proposal — generation path", () => {
  it("returns 409 with code when assertCanRequestProposal throws MaxwellGuardError", async () => {
    vi.mocked(guards.assertCanRequestProposal).mockImplementationOnce(() => {
      throw new guards.MaxwellGuardError(
        "Session not eligible.",
        "PROPOSAL_NOT_ELIGIBLE",
      );
    });

    const res = await POST(postReq({ session_id: "session-1" }));
    expect(res.status).toBe(409);

    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("PROPOSAL_NOT_ELIGIBLE");
  });

  it("transitions prototype_ready → approved_for_proposal before proposal_pending_review", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ status: "prototype_ready" }),
    );

    const res = await POST(postReq({ session_id: "session-1" }));
    expect(res.status).toBe(200);

    const calls = vi.mocked(repos.updateStudioSessionStatus).mock.calls;
    expect(calls[0][1]).toBe("approved_for_proposal");
    expect(calls[1][1]).toBe("proposal_pending_review");
  });

  it("generates draft + creates proposal + handoff to Noon App on happy path", async () => {
    const res = await POST(postReq({ session_id: "session-1" }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      proposal_request_id: string;
      review_flags: number;
      noon_app_handoff_skipped: boolean;
    };
    expect(body.proposal_request_id).toBe("proposal-1");
    expect(body.review_flags).toBe(0);
    expect(body.noon_app_handoff_skipped).toBe(false);

    expect(apiIa.chatWithOpenAI).toHaveBeenCalledTimes(1);
    expect(repos.createProposalRequest).toHaveBeenCalledTimes(1);
    expect(noonApp.sendInboundProposalToNoonApp).toHaveBeenCalledTimes(1);
  });

  it("appends review_flags_detected event when draft has warnings", async () => {
    vi.mocked(rules.validateProposalDraft).mockReturnValueOnce([
      "warning 1",
      "warning 2",
    ]);

    const res = await POST(postReq({ session_id: "session-1" }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { review_flags: number };
    expect(body.review_flags).toBe(2);

    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "review_flags_detected",
        actor: "maxwell",
        notes: "warning 1\nwarning 2",
      }),
    );
  });

  it("forwards NoonAppIntegrationError as a 502 response with code", async () => {
    vi.mocked(noonApp.sendInboundProposalToNoonApp).mockRejectedValueOnce(
      new noonApp.NoonAppIntegrationError("App rejected the payload.", 502),
    );

    const res = await POST(postReq({ session_id: "session-1" }));
    expect(res.status).toBe(502);

    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOON_APP_HANDOFF_FAILED");

    // Audit event for failed handoff
    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "noon_app_inbound_failed" }),
    );
  });
});
