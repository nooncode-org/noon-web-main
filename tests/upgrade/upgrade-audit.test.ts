/**
 * tests/upgrade/upgrade-audit.test.ts
 *
 * Coverage for `POST /api/upgrade/[id]/audit` — starts the crawl →
 * analyze pipeline. The audit pipeline itself runs in the background
 * (fire-and-forget after the 202), so tests focus on the synchronous
 * guard logic + state transition.
 *
 * Coverage matrix:
 *   - 401 unauthenticated
 *   - 404 session missing
 *   - 404 ownership mismatch
 *   - 422 when status is not 'pending' or 'error' (only those 2 can
 *     restart the audit)
 *   - 422 when URL normalization fails (canonicalize step)
 *   - 202 + status='crawling' + crawl_started event
 *   - 500 generic error path
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpgradeSession, UpgradeMode } from "@/lib/upgrade/types";

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/upgrade/repositories", () => ({
  getUpgradeSessionById: vi.fn(),
  updateSessionStatus: vi.fn(async () => undefined),
  insertUpgradePage: vi.fn(),
  upsertAudit: vi.fn(),
  insertUpgradeEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/upgrade/crawler", () => ({
  crawlWebsite: vi.fn(),
}));

vi.mock("@/lib/upgrade/analyzer", () => ({
  analyzeWebsite: vi.fn(),
}));

vi.mock("@/lib/upgrade/url-normalize", () => ({
  normalizeUrl: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as authSession from "@/lib/auth/session";
import * as repos from "@/lib/upgrade/repositories";
import * as urlNorm from "@/lib/upgrade/url-normalize";
import { POST } from "@/app/api/upgrade/[id]/audit/route";

const params = Promise.resolve({ id: "session-1" });

function req() {
  return new Request("http://localhost/api/upgrade/session-1/audit", { method: "POST" });
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue({
    email: "owner@noon.dev",
    name: "Owner",
    image: null,
  });
  vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(fakeSession());
  vi.mocked(urlNorm.normalizeUrl).mockReturnValue({
    ok: true,
    canonical: "https://example.com",
    full: "https://example.com",
  } as ReturnType<typeof urlNorm.normalizeUrl>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/upgrade/[id]/audit", () => {
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

  it.each([["crawling"], ["analyzing"], ["audit_ready"], ["version_ready"], ["transferred"]])(
    "returns 422 when status is '%s' (only 'pending' and 'error' allow re-audit)",
    async (status) => {
      vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
        fakeSession({ status: status as UpgradeSession["status"] }),
      );
      const res = await POST(req(), { params });
      expect(res.status).toBe(422);

      const body = (await res.json()) as { message: string };
      expect(body.message).toMatch(/Cannot start audit/);

      expect(repos.updateSessionStatus).not.toHaveBeenCalled();
    },
  );

  it("returns 422 when URL normalization fails", async () => {
    vi.mocked(urlNorm.normalizeUrl).mockReturnValue({
      ok: false,
      error: "Bad URL.",
    } as ReturnType<typeof urlNorm.normalizeUrl>);
    const res = await POST(req(), { params });
    expect(res.status).toBe(422);

    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("Bad URL.");
    expect(repos.updateSessionStatus).not.toHaveBeenCalled();
  });

  it("returns 202 + transitions to 'crawling' + emits crawl_started event (from pending)", async () => {
    const res = await POST(req(), { params });
    expect(res.status).toBe(202);

    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("crawling");

    expect(repos.updateSessionStatus).toHaveBeenCalledWith("session-1", "crawling");
    expect(repos.insertUpgradeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "crawl_started" }),
    );
  });

  it("ALSO allows re-audit from status='error'", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ status: "error" }),
    );
    const res = await POST(req(), { params });
    expect(res.status).toBe(202);
  });

  it("returns 500 with generic message when updateSessionStatus throws", async () => {
    vi.mocked(repos.updateSessionStatus).mockRejectedValueOnce(new Error("DB exploded"));
    const res = await POST(req(), { params });
    expect(res.status).toBe(500);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Failed to start audit/i);
    expect(body.message).not.toContain("DB exploded");
  });
});
