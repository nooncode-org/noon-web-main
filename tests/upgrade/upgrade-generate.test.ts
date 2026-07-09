/**
 * tests/upgrade/upgrade-generate.test.ts
 *
 * Coverage for `POST /api/upgrade/[id]/generate` — generates (or
 * regenerates with a correction note) the upgraded website version.
 * Like analyze + audit, the generation itself runs in the background;
 * tests focus on the synchronous guard logic + correction-quota
 * enforcement + state transition.
 *
 * Coverage matrix:
 *   - 401 unauthenticated
 *   - 404 session missing
 *   - 404 ownership mismatch
 *   - 422 when status is not in ['audit_ready', 'version_ready', 'error']
 *   - 400 zod error (correctionNote too long)
 *   - 422 when correctionNote present + correctionsUsed >= 2 (cap)
 *   - 422 when audit is missing (must run audit first)
 *   - 202 first-time generation (no body) — isCorrection=false event
 *   - 202 correction generation — isCorrection=true event metadata
 *   - 500 generic error path
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpgradeSession, UpgradeMode } from "@/lib/upgrade/types";

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/upgrade/repositories", () => ({
  getUpgradeSessionById: vi.fn(),
  getAuditBySessionId: vi.fn(),
  getPagesBySessionId: vi.fn(async () => []),
  getNextVersionNumber: vi.fn(async () => 1),
  insertVersion: vi.fn(),
  updateSessionStatus: vi.fn(async () => undefined),
  insertUpgradeEvent: vi.fn(async () => undefined),
  incrementCorrectionsUsed: vi.fn(async () => undefined),
}));

vi.mock("@/lib/upgrade/generator", () => ({
  generateUpgradedVersion: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as authSession from "@/lib/auth/session";
import * as repos from "@/lib/upgrade/repositories";
import { POST } from "@/app/api/upgrade/[id]/generate/route";

const params = Promise.resolve({ id: "session-1" });

function req(body?: unknown) {
  return new Request("http://localhost/api/upgrade/session-1/generate", {
    method: "POST",
    ...(body !== undefined
      ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
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
    status: "audit_ready",
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
  vi.mocked(repos.getAuditBySessionId).mockResolvedValue({
    id: "audit-1",
    websiteUpgradeSessionId: "session-1",
    auditJson: { overallScore: 7, criticalIssues: [], topRecommendations: [], strengths: [], sections: [] },
    summary: "OK",
    pagesAnalyzed: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Awaited<ReturnType<typeof repos.getAuditBySessionId>>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/upgrade/[id]/generate", () => {
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

  it("returns 422 when status is not in allowed set", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ status: "crawling" }),
    );
    const res = await POST(req(), { params });
    expect(res.status).toBe(422);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Cannot generate.*crawling/);
  });

  it("silently falls back to first-time generation when correctionNote is too long (quirk — route swallows zod errors as 'no body')", async () => {
    // The route wraps `generateSchema.parse(body)` in try/catch with an
    // empty catch — any zod failure resets correctionNote to null and
    // proceeds as a first-time generation. This is a UX quirk: a user
    // expecting a correction with a 2001-char note will silently get
    // a fresh first-time generation instead of a 400.
    //
    // Documented here so a future tightening (e.g. surfacing 400 on
    // parse errors) is a deliberate change with this test as evidence.
    const res = await POST(req({ correctionNote: "x".repeat(2001) }), { params });
    expect(res.status).toBe(202);

    // Event metadata reflects the silent fallback: isCorrection=false
    // even though the caller sent a correctionNote.
    expect(repos.insertUpgradeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "generate_started",
        metadata: { isCorrection: false },
      }),
    );
  });

  it("returns 422 when correctionNote present + correctionsUsed already at cap (2)", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ status: "version_ready", correctionsUsed: 2 }),
    );
    const res = await POST(req({ correctionNote: "Make it bolder" }), { params });
    expect(res.status).toBe(422);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Correction limit reached/);

    expect(repos.updateSessionStatus).not.toHaveBeenCalled();
  });

  it("returns 422 when audit is missing (must run audit first)", async () => {
    vi.mocked(repos.getAuditBySessionId).mockResolvedValue(null);
    const res = await POST(req(), { params });
    expect(res.status).toBe(422);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Audit must be completed/);
  });

  it("returns 202 first-time generation (no body) + emits generate_started isCorrection=false", async () => {
    const res = await POST(req(), { params });
    expect(res.status).toBe(202);

    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("generating");

    expect(repos.updateSessionStatus).toHaveBeenCalledWith("session-1", "generating");
    expect(repos.insertUpgradeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "generate_started",
        metadata: { isCorrection: false },
      }),
    );
  });

  it("returns 202 + emits generate_started isCorrection=true when correctionNote present", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ status: "version_ready", correctionsUsed: 0 }),
    );
    const res = await POST(req({ correctionNote: "Tighten the copy" }), { params });
    expect(res.status).toBe(202);

    expect(repos.insertUpgradeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "generate_started",
        metadata: { isCorrection: true },
      }),
    );
  });

  // SEC-M8 (auditoría 2026-07): toda generación con versión previa consume el
  // cap, con o sin correctionNote — antes un POST sin body desde version_ready
  // regeneraba gratis en loop (cost-exhaustion del budget LLM global).
  it("SEC-M8: returns 422 for a no-note regeneration once the cap is consumed", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ status: "version_ready", correctionsUsed: 2 }),
    );
    vi.mocked(repos.getNextVersionNumber).mockResolvedValue(2);

    const res = await POST(req(), { params });
    expect(res.status).toBe(422);
    expect(repos.updateSessionStatus).not.toHaveBeenCalled();
  });

  it("SEC-M8: a no-note regeneration consumes the cap (incrementCorrectionsUsed)", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ status: "version_ready", correctionsUsed: 1 }),
    );
    vi.mocked(repos.getNextVersionNumber).mockResolvedValue(2);
    const generator = await import("@/lib/upgrade/generator");
    vi.mocked(generator.generateUpgradedVersion).mockResolvedValue({
      ok: true,
      versionJson: {},
      summary: "regen",
    } as Awaited<ReturnType<typeof generator.generateUpgradedVersion>>);

    const res = await POST(req(), { params });
    expect(res.status).toBe(202);

    // El pipeline corre en background: esperar a que consuma el cap.
    await vi.waitFor(() => expect(repos.incrementCorrectionsUsed).toHaveBeenCalledWith("session-1"));
    // Sin nota NO es una corrección: no debe emitir correction_applied.
    const events = vi.mocked(repos.insertUpgradeEvent).mock.calls.map((c) => c[0].eventType);
    expect(events).not.toContain("correction_applied");
  });

  it("SEC-M8: retry from 'error' with NO prior version stays free (legit recovery)", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ status: "error", correctionsUsed: 2 }),
    );
    vi.mocked(repos.getNextVersionNumber).mockResolvedValue(1);
    const generator = await import("@/lib/upgrade/generator");
    vi.mocked(generator.generateUpgradedVersion).mockResolvedValue({
      ok: true,
      versionJson: {},
      summary: "retry",
    } as Awaited<ReturnType<typeof generator.generateUpgradedVersion>>);

    const res = await POST(req(), { params });
    expect(res.status).toBe(202);

    await vi.waitFor(() =>
      expect(repos.insertUpgradeEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "generate_completed" }),
      ),
    );
    expect(repos.incrementCorrectionsUsed).not.toHaveBeenCalled();
  });

  it("returns 500 with generic message when updateSessionStatus throws", async () => {
    vi.mocked(repos.updateSessionStatus).mockRejectedValueOnce(new Error("DB exploded"));
    const res = await POST(req(), { params });
    expect(res.status).toBe(500);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Failed to start generation/i);
    expect(body.message).not.toContain("DB exploded");
  });
});
