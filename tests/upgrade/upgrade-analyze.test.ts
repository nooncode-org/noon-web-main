/**
 * tests/upgrade/upgrade-analyze.test.ts
 *
 * Coverage for `POST /api/upgrade/[id]/analyze` — the manual trigger
 * that advances answer_questions-mode sessions from crawl_done →
 * analyzing. The actual analysis runs in the background (fire-and-
 * forget after the 202 response), so we test the SYNCHRONOUS
 * response + state transition; the background pipeline is exercised
 * indirectly via the analyzer module's own tests.
 *
 * Coverage matrix:
 *   - 401 unauthenticated
 *   - 404 session missing
 *   - 404 ownership mismatch (same as missing — the route conflates
 *     them intentionally to avoid leaking existence to non-owners)
 *   - 422 when status is not "crawl_done" (e.g. still crawling, or
 *     already analyzed)
 *   - 202 on happy path with audit_started event + status transition
 *     to "analyzing"
 *   - 500 generic error path
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpgradeSession, UpgradeMode } from "@/lib/upgrade/types";

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/upgrade/repositories", () => ({
  getUpgradeSessionById: vi.fn(),
  getPagesBySessionId: vi.fn(async () => []),
  upsertAudit: vi.fn(),
  updateSessionStatus: vi.fn(async () => undefined),
  insertUpgradeEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/upgrade/analyzer", () => ({
  analyzeWebsite: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as authSession from "@/lib/auth/session";
import * as repos from "@/lib/upgrade/repositories";
import { POST } from "@/app/api/upgrade/[id]/analyze/route";

const params = Promise.resolve({ id: "session-1" });

function req() {
  return new Request("http://localhost/api/upgrade/session-1/analyze", { method: "POST" });
}

function fakeSession(overrides: Partial<UpgradeSession> = {}): UpgradeSession {
  return {
    id: "session-1",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    websiteUrl: "https://example.com",
    websiteUrlRaw: "example.com",
    mode: "answer_questions" as UpgradeMode,
    contextNote: null,
    questionsAnswers: [],
    status: "crawl_done",
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
  vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(fakeSession());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/upgrade/[id]/analyze", () => {
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

  it("returns 404 when viewer is not the owner (no enumeration leak)", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ ownerEmail: "stranger@noon.dev" }),
    );
    const res = await POST(req(), { params });
    // Intentionally 404, not 403 — don't leak "session exists but you can't see it"
    expect(res.status).toBe(404);
  });

  it("returns 422 when session.status is not 'crawl_done'", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ status: "crawling" }),
    );
    const res = await POST(req(), { params });
    expect(res.status).toBe(422);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Cannot analyze.*crawling/);

    expect(repos.updateSessionStatus).not.toHaveBeenCalled();
  });

  it("returns 202 + transitions to 'analyzing' + emits audit_started event", async () => {
    const res = await POST(req(), { params });
    expect(res.status).toBe(202);

    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("analyzing");

    expect(repos.updateSessionStatus).toHaveBeenCalledWith("session-1", "analyzing");
    expect(repos.insertUpgradeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "session-1", eventType: "audit_started" }),
    );
  });

  it("returns 500 with generic message when something throws upstream", async () => {
    vi.mocked(repos.updateSessionStatus).mockRejectedValueOnce(new Error("DB exploded"));
    const res = await POST(req(), { params });
    expect(res.status).toBe(500);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Failed to start analysis/i);
    expect(body.message).not.toContain("DB exploded");
  });
});
