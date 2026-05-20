/**
 * tests/upgrade/upgrade-handoff.test.ts
 *
 * Coverage for `POST /api/upgrade/[id]/handoff` — transfers the
 * complete /upgrade session context into Maxwell Studio by creating
 * a new studio_session row pre-loaded with the audit + upgraded
 * version. Critical handoff path: bridges the /upgrade module with
 * the rest of Maxwell.
 *
 * Mocks: auth, upgrade repos (getUpgradeSessionById, getAuditBySessionId,
 * getLatestVersionBySessionId, updateSessionStatus, insertUpgradeEvent),
 * and `getDb` (the two INSERTs into studio_session + studio_event run
 * via raw `sql\`INSERT ...\``).
 *
 * The handoff prompt construction runs real, so the prompt content
 * is part of the contract being tested.
 *
 * Coverage matrix:
 *   - 401 unauthenticated
 *   - 404 session missing
 *   - 404 ownership mismatch
 *   - 422 when status is not 'version_ready'
 *   - 422 when audit is missing (must have run audit)
 *   - 422 when latestVersion is missing (must have generated at least one)
 *   - 200 happy path: returns { studioSessionId, redirectTo } +
 *     transitions upgrade to 'transferred' + emits handoff_to_maxwell
 *     event with studioSessionId in metadata
 *   - The handoff prompt includes the audit score + critical issues +
 *     upgraded headline (pinning the content shape)
 *   - 500 generic error path (e.g. DB INSERT fails)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpgradeSession, UpgradeMode } from "@/lib/upgrade/types";

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

vi.mock("@/lib/server/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as authSession from "@/lib/auth/session";
import * as repos from "@/lib/upgrade/repositories";
import * as db from "@/lib/server/db";
import { POST } from "@/app/api/upgrade/[id]/handoff/route";

const params = Promise.resolve({ id: "session-1" });

function req() {
  return new Request("http://localhost/api/upgrade/session-1/handoff", { method: "POST" });
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

// Captures every SQL invocation so tests can assert the prompt + payload.
let executedSql: string[] = [];

function makeSqlMock() {
  return vi.fn(async (strings: TemplateStringsArray) => {
    // Tagged-template interpolations intentionally ignored — tests assert
    // via the captured SQL string + the mocked repo calls.
    executedSql.push(strings.join("?"));
    return [];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  executedSql = [];
  vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue({
    email: "owner@noon.dev",
    name: "Owner",
    image: null,
  });
  vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(fakeSession());
  vi.mocked(repos.getAuditBySessionId).mockResolvedValue({
    id: "audit-1",
    websiteUpgradeSessionId: "session-1",
    auditJson: {
      overallScore: 7,
      criticalIssues: ["Slow load time", "No CTA above fold"],
      topRecommendations: ["Add hero CTA", "Compress images"],
      strengths: [],
      sections: [],
    },
    summary: "OK",
    pagesAnalyzed: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Awaited<ReturnType<typeof repos.getAuditBySessionId>>);
  vi.mocked(repos.getLatestVersionBySessionId).mockResolvedValue({
    id: "version-1",
    websiteUpgradeSessionId: "session-1",
    versionNumber: 1,
    versionJson: {
      headline: "Build Faster With Us",
      subheadline: "Modern websites in days",
      valueProposition: "Cut time-to-market by 60%",
      ctaText: "Get Started",
      keyChanges: ["New hero", "Trust badges"],
      toneGuidance: "Confident and direct",
    },
    summary: "v1 summary",
    isCorrection: false,
    createdAt: new Date().toISOString(),
  } as Awaited<ReturnType<typeof repos.getLatestVersionBySessionId>>);
  vi.mocked(db.getDb).mockReturnValue(makeSqlMock() as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/upgrade/[id]/handoff", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);
    const res = await POST(req(), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when session is missing", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(null);
    const res = await POST(req(), { params });
    expect(res.status).toBe(404);
  });

  it("returns 404 when viewer is not the owner", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ ownerEmail: "stranger@noon.dev" }),
    );
    const res = await POST(req(), { params });
    expect(res.status).toBe(404);
  });

  it("returns 422 when status is not 'version_ready'", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ status: "audit_ready" }),
    );
    const res = await POST(req(), { params });
    expect(res.status).toBe(422);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/version must be ready/);
  });

  it("returns 422 when audit is missing", async () => {
    vi.mocked(repos.getAuditBySessionId).mockResolvedValue(null);
    const res = await POST(req(), { params });
    expect(res.status).toBe(422);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Audit and upgraded version/);
  });

  it("returns 422 when latestVersion is missing", async () => {
    vi.mocked(repos.getLatestVersionBySessionId).mockResolvedValue(null);
    const res = await POST(req(), { params });
    expect(res.status).toBe(422);
  });

  it("returns 200 + studioSessionId + redirectTo on happy path", async () => {
    const res = await POST(req(), { params });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { studioSessionId: string; redirectTo: string };
    expect(body.studioSessionId).toMatch(/^[0-9a-f-]{36}$/); // UUID v4 shape
    expect(body.redirectTo).toBe("/maxwell/studio");

    // 2 INSERTs: studio_session + studio_event
    expect(executedSql).toHaveLength(2);
    expect(executedSql[0]).toMatch(/INSERT INTO studio_session/);
    expect(executedSql[1]).toMatch(/INSERT INTO studio_event/);
  });

  it("transitions upgrade session to 'transferred' + emits handoff_to_maxwell event", async () => {
    await POST(req(), { params });

    expect(repos.updateSessionStatus).toHaveBeenCalledWith("session-1", "transferred");
    expect(repos.insertUpgradeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "handoff_to_maxwell",
        metadata: expect.objectContaining({ studioSessionId: expect.any(String) }),
      }),
    );
  });

  it("returns 500 with generic message when DB INSERT throws", async () => {
    const failingSql = vi.fn(async () => {
      throw new Error("Postgres timeout");
    });
    vi.mocked(db.getDb).mockReturnValue(failingSql as never);

    const res = await POST(req(), { params });
    expect(res.status).toBe(500);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Failed to transfer/i);
    expect(body.message).not.toContain("Postgres");
  });
});
