/**
 * tests/upgrade/upgrade-proposal.test.ts
 *
 * Coverage for `POST /api/upgrade/[id]/proposal` — the most complex
 * route in the /upgrade module. Glues the upgrade flow to Maxwell's
 * proposal pipeline:
 *   1. Validates upgrade session is in version_ready with audit + version
 *   2. Creates a new studio_session pre-loaded with the upgrade context
 *   3. Generates the proposal draft via the LLM
 *   4. Creates a proposal_request (enters Maxwell's review queue)
 *   5. Marks upgrade session as 'proposal_sent'
 *
 * Coverage matrix:
 *   - 401 unauthenticated
 *   - 404 session missing
 *   - 404 ownership mismatch
 *   - 422 when status is not 'version_ready'
 *   - 422 when audit is missing
 *   - 422 when latestVersion is missing
 *   - 200 happy path: returns proposalRequestId + status='proposal_sent'
 *   - Upgrade session transitioned to 'proposal_sent' + proposal_requested event
 *   - chatWithOpenAI tagged with category=upgrade_generator
 *   - 500 generic error path
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpgradeSession, UpgradeMode } from "@/lib/upgrade/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/upgrade/repositories", () => ({
  getUpgradeSessionById: vi.fn(),
  getAuditBySessionId: vi.fn(),
  getLatestVersionBySessionId: vi.fn(),
  updateSessionStatus: vi.fn(async () => undefined),
  insertUpgradeEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  updateStudioSessionStatus: vi.fn(async () => undefined),
  getStudioMessagesForOpenAI: vi.fn(async () => []),
  getStudioVersions: vi.fn(async () => []),
  createProposalRequest: vi.fn(),
  appendProposalReviewEvent: vi.fn(async () => undefined),
  appendStudioMessage: vi.fn(async () => undefined),
}));

vi.mock("@/lib/maxwell/proposal-rules", () => ({
  buildProposalContext: vi.fn(() => "RICH CONTEXT"),
  resolveProposalCommercialProfile: vi.fn(() => ({ membershipRecommended: true })),
  validateProposalDraft: vi.fn(() => []),
}));

vi.mock("@/lib/maxwell/proposal-lifecycle", () => ({
  classifyProposalCase: vi.fn(() => "normal"),
}));

vi.mock("@/lib/maxwell/proposal-content", () => ({
  stripInternalReviewFlags: vi.fn((s: string) => s),
}));

vi.mock("@/lib/api-ia", () => ({
  chatWithOpenAI: vi.fn(),
}));

vi.mock("@/lib/server/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as authSession from "@/lib/auth/session";
import * as upgradeRepos from "@/lib/upgrade/repositories";
import * as maxwellRepos from "@/lib/maxwell/repositories";
import * as apiIa from "@/lib/api-ia";
import * as db from "@/lib/server/db";
import { POST } from "@/app/api/upgrade/[id]/proposal/route";

const params = Promise.resolve({ id: "session-1" });

function req() {
  return new Request("http://localhost/api/upgrade/session-1/proposal", { method: "POST" });
}

function fakeSession(overrides: Partial<UpgradeSession> = {}): UpgradeSession {
  return {
    id: "session-1",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    websiteUrl: "https://example.com",
    websiteUrlRaw: "example.com",
    mode: "best_judgment" as UpgradeMode,
    contextNote: null,
    questionsAnswers: [],
    status: "version_ready",
    correctionsUsed: 0,
    source: "web",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    archivedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue({
    email: "owner@noon.dev",
    name: "Owner",
    image: null,
  });
  vi.mocked(upgradeRepos.getUpgradeSessionById).mockResolvedValue(fakeSession());
  vi.mocked(upgradeRepos.getAuditBySessionId).mockResolvedValue({
    id: "audit-1",
    websiteUpgradeSessionId: "session-1",
    auditJson: {
      overallScore: 7,
      criticalIssues: ["Slow"],
      topRecommendations: ["Add CTA"],
      strengths: [],
      sections: [],
    },
    summary: "OK",
    pagesAnalyzed: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Awaited<ReturnType<typeof upgradeRepos.getAuditBySessionId>>);
  vi.mocked(upgradeRepos.getLatestVersionBySessionId).mockResolvedValue({
    id: "version-1",
    websiteUpgradeSessionId: "session-1",
    versionNumber: 1,
    versionJson: {
      headline: "New",
      subheadline: "Sub",
      valueProposition: "Value",
      ctaText: "Go",
      keyChanges: ["Change A"],
      toneGuidance: "Confident",
    },
    summary: "v1",
    isCorrection: false,
    createdAt: new Date().toISOString(),
  } as Awaited<ReturnType<typeof upgradeRepos.getLatestVersionBySessionId>>);
  vi.mocked(apiIa.chatWithOpenAI).mockResolvedValue({ reply: "Generated proposal draft." });
  vi.mocked(maxwellRepos.createProposalRequest).mockResolvedValue({
    id: "prop-1",
    status: "pending_review",
  } as Awaited<ReturnType<typeof maxwellRepos.createProposalRequest>>);
  vi.mocked(db.getDb).mockReturnValue(
    vi.fn(async () => []) as never, // raw INSERT into studio_session
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/upgrade/[id]/proposal", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);
    const res = await POST(req(), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when session is missing", async () => {
    vi.mocked(upgradeRepos.getUpgradeSessionById).mockResolvedValue(null);
    const res = await POST(req(), { params });
    expect(res.status).toBe(404);
  });

  it("returns 404 when viewer is not the owner", async () => {
    vi.mocked(upgradeRepos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ ownerEmail: "stranger@noon.dev" }),
    );
    const res = await POST(req(), { params });
    expect(res.status).toBe(404);
  });

  it("returns 422 when status is not 'version_ready'", async () => {
    vi.mocked(upgradeRepos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ status: "audit_ready" }),
    );
    const res = await POST(req(), { params });
    expect(res.status).toBe(422);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/version must be ready/);
  });

  it("returns 422 when audit is missing", async () => {
    vi.mocked(upgradeRepos.getAuditBySessionId).mockResolvedValue(null);
    const res = await POST(req(), { params });
    expect(res.status).toBe(422);
  });

  it("returns 422 when latestVersion is missing", async () => {
    vi.mocked(upgradeRepos.getLatestVersionBySessionId).mockResolvedValue(null);
    const res = await POST(req(), { params });
    expect(res.status).toBe(422);
  });

  it("returns 200 on happy path with proposalRequestId + status", async () => {
    const res = await POST(req(), { params });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { proposalRequestId: string; status: string };
    expect(body.proposalRequestId).toBe("prop-1");
    expect(body.status).toBe("proposal_sent");
  });

  it("transitions upgrade session to 'proposal_sent' + emits proposal_requested event", async () => {
    await POST(req(), { params });

    expect(upgradeRepos.updateSessionStatus).toHaveBeenCalledWith("session-1", "proposal_sent");
    expect(upgradeRepos.insertUpgradeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "proposal_requested",
        metadata: expect.objectContaining({ proposalRequestId: "prop-1" }),
      }),
    );
  });

  it("tags the LLM call with category=upgrade_generator (G-D2 budget attribution)", async () => {
    await POST(req(), { params });

    expect(apiIa.chatWithOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "upgrade_generator",
      }),
    );
  });

  it("returns 500 with generic message when something throws upstream (no leak)", async () => {
    vi.mocked(maxwellRepos.createProposalRequest).mockRejectedValueOnce(
      new Error("DB exploded"),
    );
    const res = await POST(req(), { params });
    expect(res.status).toBe(500);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Failed to create proposal/i);
    expect(body.message).not.toContain("DB exploded");
  });
});
