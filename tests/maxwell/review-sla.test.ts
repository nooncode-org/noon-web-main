/**
 * tests/maxwell/review-sla.test.ts
 *
 * Coverage for `GET|POST /api/maxwell/review-sla` — cron-triggered
 * surface that nudges/escalates pending Noon App proposal reviews.
 *
 * Mocks: `processProposalReviewSla` (the SLA processor lives in
 * lib/maxwell/proposal-review-sla and is itself separately tested) and
 * `resolvePublicBaseUrl`. The route's own auth gating + dual-method
 * dispatch + error handling run real.
 *
 * Auth model under test:
 *   - In production with no secrets configured → ALL requests are
 *     unauthorized (safe default, lock-down).
 *   - In non-production with no secrets → ALL requests authorized
 *     (dev convenience).
 *   - With REVIEW_API_SECRET or CRON_SECRET set → only matching
 *     Bearer header passes.
 *
 * Coverage matrix:
 *   - Production + no secrets → 401 (both GET and POST)
 *   - Dev + no secrets → 200 (open for local cron testing)
 *   - REVIEW_API_SECRET set + matching Bearer → 200
 *   - CRON_SECRET set + matching Bearer → 200
 *   - Either secret set + WRONG Bearer → 401
 *   - Either secret set + NO Authorization header → 401
 *   - Both GET and POST exercise the same auth + processor path
 *   - Processor throws → 500 with generic message
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/maxwell/proposal-review-sla", () => ({
  processProposalReviewSla: vi.fn(),
}));

vi.mock("@/lib/maxwell/public-url", () => ({
  resolvePublicBaseUrl: vi.fn(() => "https://noon.com"),
}));

import * as sla from "@/lib/maxwell/proposal-review-sla";
import { GET, POST } from "@/app/api/maxwell/review-sla/route";

const ROUTE = "http://localhost/api/maxwell/review-sla";

function req(method: "GET" | "POST", headers: Record<string, string> = {}) {
  return new Request(ROUTE, { method, headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Clear both env vars so each test sets them explicitly.
  vi.stubEnv("REVIEW_API_SECRET", "");
  vi.stubEnv("CRON_SECRET", "");
  vi.stubEnv("NODE_ENV", "production"); // safest default for tests

  vi.mocked(sla.processProposalReviewSla).mockResolvedValue({
    evaluated: 0,
    reminded: 0,
    escalated: 0,
    autoSent: 0,
    blocked: 0,
    affectedProposalIds: [],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Auth — production lock-down
// ---------------------------------------------------------------------------

describe("review-sla — production auth lock-down", () => {
  it("returns 401 on GET when in production with no secrets configured", async () => {
    const res = await GET(req("GET"));
    expect(res.status).toBe(401);
    expect(sla.processProposalReviewSla).not.toHaveBeenCalled();
  });

  it("returns 401 on POST when in production with no secrets configured", async () => {
    const res = await POST(req("POST"));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Auth — dev convenience
// ---------------------------------------------------------------------------

describe("review-sla — dev mode (no secrets) is open", () => {
  it("returns 200 in dev with no secrets configured (intentional convenience)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    expect(sla.processProposalReviewSla).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Auth — Bearer with REVIEW_API_SECRET
// ---------------------------------------------------------------------------

describe("review-sla — REVIEW_API_SECRET Bearer auth", () => {
  beforeEach(() => {
    vi.stubEnv("REVIEW_API_SECRET", "review-secret-123");
  });

  it("allows matching Bearer", async () => {
    const res = await GET(
      req("GET", { authorization: "Bearer review-secret-123" }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects wrong Bearer with 401", async () => {
    const res = await GET(
      req("GET", { authorization: "Bearer wrong-token" }),
    );
    expect(res.status).toBe(401);
    expect(sla.processProposalReviewSla).not.toHaveBeenCalled();
  });

  it("rejects requests with no Authorization header", async () => {
    const res = await GET(req("GET"));
    expect(res.status).toBe(401);
  });

  it("works the same on POST", async () => {
    const res = await POST(
      req("POST", { authorization: "Bearer review-secret-123" }),
    );
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Auth — Bearer with CRON_SECRET (Vercel Cron path)
// ---------------------------------------------------------------------------

describe("review-sla — CRON_SECRET Bearer auth", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "vercel-cron-abc");
  });

  it("allows matching CRON_SECRET Bearer", async () => {
    const res = await GET(
      req("GET", { authorization: "Bearer vercel-cron-abc" }),
    );
    expect(res.status).toBe(200);
  });

  it("accepts either secret when BOTH are configured", async () => {
    vi.stubEnv("REVIEW_API_SECRET", "review-token");

    const resCron = await GET(req("GET", { authorization: "Bearer vercel-cron-abc" }));
    expect(resCron.status).toBe(200);

    const resReview = await GET(req("GET", { authorization: "Bearer review-token" }));
    expect(resReview.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Processor invocation + response shape
// ---------------------------------------------------------------------------

describe("review-sla — processor invocation", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "ok");
  });

  it("returns the processor result inside { message, result }", async () => {
    vi.mocked(sla.processProposalReviewSla).mockResolvedValue({
      evaluated: 5,
      reminded: 2,
      escalated: 1,
      autoSent: 1,
      blocked: 0,
      affectedProposalIds: ["p1", "p2", "p3", "p4"],
    });

    const res = await GET(req("GET", { authorization: "Bearer ok" }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      message: string;
      result: {
        evaluated: number;
        reminded: number;
        escalated: number;
        autoSent: number;
        blocked: number;
        affectedProposalIds: string[];
      };
    };
    expect(body.message).toMatch(/processed/i);
    expect(body.result).toEqual({
      evaluated: 5,
      reminded: 2,
      escalated: 1,
      autoSent: 1,
      blocked: 0,
      affectedProposalIds: ["p1", "p2", "p3", "p4"],
    });
  });

  it("returns 500 with generic message when the processor throws", async () => {
    vi.mocked(sla.processProposalReviewSla).mockRejectedValueOnce(
      new Error("DB connection lost"),
    );

    const res = await GET(req("GET", { authorization: "Bearer ok" }));
    expect(res.status).toBe(500);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/could not process/i);
    expect(body.message).not.toContain("DB"); // internal error not leaked
  });
});
