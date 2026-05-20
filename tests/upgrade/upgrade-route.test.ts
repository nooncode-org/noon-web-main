/**
 * tests/upgrade/upgrade-route.test.ts
 *
 * Coverage for the upgrade module entry points:
 *   - POST /api/upgrade        — create or resume an upgrade session
 *   - GET  /api/upgrade        — list the viewer's upgrade sessions
 *   - GET  /api/upgrade/[id]   — fetch one session with full details
 *
 * Mocked: auth (getAuthenticatedViewer), upgrade repositories, the
 * URL normalizer, the session-limit checker. Zod, the existing-session
 * reuse branch, ownership check, and event-audit calls all run real.
 *
 * Coverage matrix:
 *   POST /api/upgrade:
 *     - 401 unauthenticated
 *     - 400 zod error (missing websiteUrl)
 *     - 422 url normalize fails
 *     - 200 + resumed=true when an active session for the same URL exists
 *       (no session-limit check, no createSession call, BUT a
 *       "session_resumed" event IS emitted)
 *     - 429 when the user has hit the 3-sessions-in-30-days cap
 *     - 201 + resumed=false on happy create (with limit info in the
 *       audit event metadata)
 *     - 500 generic error path
 *   GET /api/upgrade:
 *     - 401 unauthenticated
 *     - 200 with sessions array
 *     - 500 on repo failure
 *   GET /api/upgrade/[id]:
 *     - 401 unauthenticated
 *     - 404 session missing
 *     - 403 ownership mismatch
 *     - 200 with full SessionWithDetails on happy path
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  UpgradeMode,
  UpgradeSession,
  SessionWithDetails,
} from "@/lib/upgrade/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/upgrade/url-normalize", () => ({
  normalizeUrl: vi.fn(),
}));

vi.mock("@/lib/upgrade/session-limits", () => ({
  checkSessionLimit: vi.fn(),
}));

vi.mock("@/lib/upgrade/repositories", () => ({
  createUpgradeSession: vi.fn(),
  findActiveSessionByUrl: vi.fn(),
  listUserSessions: vi.fn(),
  insertUpgradeEvent: vi.fn(async () => undefined),
  getUpgradeSessionById: vi.fn(),
  getSessionWithDetails: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as authSession from "@/lib/auth/session";
import * as urlNorm from "@/lib/upgrade/url-normalize";
import * as sessionLimits from "@/lib/upgrade/session-limits";
import * as repos from "@/lib/upgrade/repositories";

import { POST, GET as listGET } from "@/app/api/upgrade/route";
import { GET as detailGET } from "@/app/api/upgrade/[id]/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROUTE_LIST = "http://localhost/api/upgrade";

function postReq(body: unknown) {
  return new Request(ROUTE_LIST, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getReq() {
  return new Request(ROUTE_LIST, { method: "GET" });
}

function detailReq() {
  return new Request("http://localhost/api/upgrade/session-1", { method: "GET" });
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
    status: "pending",
    correctionsUsed: 0,
    source: "web",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    archivedAt: null,
    ...overrides,
  };
}

function fakeSessionDetails(): SessionWithDetails {
  return {
    ...fakeSession(),
    audit: null,
    latestVersion: null,
    pageCount: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue({
    email: "owner@noon.dev",
    name: "Owner",
    image: null,
  });
  vi.mocked(urlNorm.normalizeUrl).mockReturnValue({
    ok: true,
    canonical: "https://example.com",
  } as ReturnType<typeof urlNorm.normalizeUrl>);
  vi.mocked(sessionLimits.checkSessionLimit).mockResolvedValue({
    allowed: true,
    used: 0,
    remaining: 3,
  });
  vi.mocked(repos.findActiveSessionByUrl).mockResolvedValue(null);
  vi.mocked(repos.createUpgradeSession).mockResolvedValue(fakeSession());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// POST /api/upgrade
// ---------------------------------------------------------------------------

describe("POST /api/upgrade", () => {
  it("returns 401 when viewer is not authenticated", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);

    const res = await POST(postReq({ websiteUrl: "example.com", mode: "best_judgment" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 with fieldErrors when websiteUrl is missing", async () => {
    const res = await POST(postReq({ mode: "best_judgment" }));
    expect(res.status).toBe(400);

    const body = (await res.json()) as { fieldErrors: Record<string, string[]> };
    expect(body.fieldErrors.websiteUrl).toBeDefined();
  });

  it("returns 422 when URL normalization fails", async () => {
    vi.mocked(urlNorm.normalizeUrl).mockReturnValue({
      ok: false,
      error: "Invalid URL format.",
    } as ReturnType<typeof urlNorm.normalizeUrl>);

    const res = await POST(postReq({ websiteUrl: "not a url", mode: "best_judgment" }));
    expect(res.status).toBe(422);

    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("Invalid URL format.");
    // Session limit + create NOT reached
    expect(sessionLimits.checkSessionLimit).not.toHaveBeenCalled();
    expect(repos.createUpgradeSession).not.toHaveBeenCalled();
  });

  it("returns 200 + resumed=true when an active session for the URL already exists", async () => {
    const existing = fakeSession({ id: "session-existing", status: "audit_ready" });
    vi.mocked(repos.findActiveSessionByUrl).mockResolvedValue(existing);

    const res = await POST(
      postReq({ websiteUrl: "example.com", mode: "best_judgment" }),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { session: UpgradeSession; resumed: boolean };
    expect(body.session.id).toBe("session-existing");
    expect(body.resumed).toBe(true);

    // Did NOT check session limit (reuse path skips it) and did NOT
    // call createUpgradeSession.
    expect(sessionLimits.checkSessionLimit).not.toHaveBeenCalled();
    expect(repos.createUpgradeSession).not.toHaveBeenCalled();

    // BUT it DID emit a session_resumed audit event.
    expect(repos.insertUpgradeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-existing",
        eventType: "session_resumed",
      }),
    );
  });

  it("returns 429 when the user has hit the 3-sessions-in-30-days cap", async () => {
    vi.mocked(sessionLimits.checkSessionLimit).mockResolvedValue({
      allowed: false,
      used: 3,
      resetAt: "2026-06-19T00:00:00.000Z",
    });

    const res = await POST(
      postReq({ websiteUrl: "example.com", mode: "best_judgment" }),
    );
    expect(res.status).toBe(429);

    const body = (await res.json()) as { message: string; resetAt: string };
    expect(body.message).toMatch(/limit of 3/);
    expect(body.resetAt).toBe("2026-06-19T00:00:00.000Z");

    expect(repos.createUpgradeSession).not.toHaveBeenCalled();
  });

  it("returns 201 + resumed=false on happy create + emits session_created event with limit info", async () => {
    const res = await POST(
      postReq({
        websiteUrl: "example.com",
        mode: "answer_questions",
        contextNote: "Looking for a CMS modernization",
      }),
    );
    expect(res.status).toBe(201);

    const body = (await res.json()) as { session: UpgradeSession; resumed: boolean };
    expect(body.resumed).toBe(false);
    expect(body.session.id).toBe("session-1");

    expect(repos.createUpgradeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerEmail: "owner@noon.dev",
        websiteUrl: "https://example.com", // normalized canonical
        websiteUrlRaw: "example.com",
        mode: "answer_questions",
        contextNote: "Looking for a CMS modernization",
      }),
    );

    // Audit event carries the post-increment limit counters.
    expect(repos.insertUpgradeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        eventType: "session_created",
        metadata: expect.objectContaining({
          url: "https://example.com",
          mode: "answer_questions",
          limitUsed: 1,
          limitRemaining: 2,
        }),
      }),
    );
  });

  it("returns 500 with generic message when createUpgradeSession throws (no leak)", async () => {
    vi.mocked(repos.createUpgradeSession).mockRejectedValue(new Error("DB exploded"));

    const res = await POST(
      postReq({ websiteUrl: "example.com", mode: "best_judgment" }),
    );
    expect(res.status).toBe(500);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Failed to create/i);
    expect(body.message).not.toContain("DB exploded");
  });
});

// ---------------------------------------------------------------------------
// GET /api/upgrade
// ---------------------------------------------------------------------------

describe("GET /api/upgrade — list sessions", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);

    const res = await listGET();
    expect(res.status).toBe(401);
  });

  it("returns 200 with the viewer's sessions", async () => {
    vi.mocked(repos.listUserSessions).mockResolvedValue([
      fakeSession({ id: "s1" }),
      fakeSession({ id: "s2", status: "audit_ready" }),
    ]);

    const res = await listGET();
    expect(res.status).toBe(200);

    const body = (await res.json()) as { sessions: UpgradeSession[] };
    expect(body.sessions).toHaveLength(2);
    expect(body.sessions[0].id).toBe("s1");

    expect(repos.listUserSessions).toHaveBeenCalledWith("owner@noon.dev");
  });

  it("returns 500 with generic message when listUserSessions throws", async () => {
    vi.mocked(repos.listUserSessions).mockRejectedValue(new Error("repo down"));

    const res = await listGET();
    expect(res.status).toBe(500);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Failed to fetch/i);
    expect(body.message).not.toContain("repo down");
  });
});

// ---------------------------------------------------------------------------
// GET /api/upgrade/[id]
// ---------------------------------------------------------------------------

describe("GET /api/upgrade/[id] — session detail", () => {
  const params = Promise.resolve({ id: "session-1" });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);

    const res = await detailGET(detailReq(), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when session is missing", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(null);

    const res = await detailGET(detailReq(), { params });
    expect(res.status).toBe(404);
  });

  it("returns 403 when viewer is not the owner", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ ownerEmail: "someone-else@noon.dev" }),
    );

    const res = await detailGET(detailReq(), { params });
    expect(res.status).toBe(403);
  });

  it("returns 200 with SessionWithDetails on the happy path", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(fakeSession());
    vi.mocked(repos.getSessionWithDetails).mockResolvedValue(fakeSessionDetails());

    const res = await detailGET(detailReq(), { params });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { session: SessionWithDetails };
    expect(body.session.id).toBe("session-1");
    // pageCount field present (this is what makes it "with details")
    expect(body.session.pageCount).toBe(0);
    expect(body.session.audit).toBeNull();
    expect(body.session.latestVersion).toBeNull();
  });
});
