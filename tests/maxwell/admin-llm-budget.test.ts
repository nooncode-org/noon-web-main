/**
 * tests/maxwell/admin-llm-budget.test.ts
 *
 * Coverage for `GET /api/maxwell/admin/llm-budget` — the ops dashboard
 * endpoint added in feat/llm-budget-dashboard-endpoint.
 *
 * Mocked: getReviewRequestAccess (auth gate), getMonthlyUsage (the
 * tracker). The response-shape construction (snake_case + thresholds
 * + status derivation) runs real so a future refactor of those
 * conventions is caught here.
 *
 * Coverage matrix:
 *   - Auth: sign_in_required → 401; not_allowed/not_configured → 403
 *   - Happy path: returns snake_case payload with cap/total/ratio/
 *     thresholds/status
 *   - Status derivation: ok / warn (>=50%) / critical (>=80%) /
 *     hard_stop (>=100%)
 *   - DB error → 503 with code LLM_BUDGET_DATA_UNAVAILABLE
 *   - Cache-Control: no-store (anti-caching)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/review", () => ({
  getReviewRequestAccess: vi.fn(),
}));

vi.mock("@/lib/server/llm-budget", () => ({
  getMonthlyUsage: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as auth from "@/lib/auth/review";
import * as budget from "@/lib/server/llm-budget";
import { GET } from "@/app/api/maxwell/admin/llm-budget/route";

const ROUTE = "http://localhost/api/maxwell/admin/llm-budget";

function req() {
  return new Request(ROUTE, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.getReviewRequestAccess).mockResolvedValue({
    authorized: true,
    via: "session",
    actor: "ops@noon.dev",
    viewer: { email: "ops@noon.dev", name: "Ops", image: null },
  });
  vi.mocked(budget.getMonthlyUsage).mockResolvedValue({
    capUsd: 200,
    totalUsd: 25,
    ratio: 0.125,
    byCategory: { chat: 20, brief_extractor: 5 },
    byProvider: { openai: 25 },
    callCount: 42,
    periodMonth: "2026-05-01",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("GET /api/maxwell/admin/llm-budget — auth", () => {
  it("returns 401 when reason=sign_in_required", async () => {
    vi.mocked(auth.getReviewRequestAccess).mockResolvedValue({
      authorized: false,
      reason: "sign_in_required",
      viewer: null,
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns 403 when reason=not_allowed", async () => {
    vi.mocked(auth.getReviewRequestAccess).mockResolvedValue({
      authorized: false,
      reason: "not_allowed",
      viewer: { email: "stranger@x.dev", name: null, image: null },
    });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it("returns 403 when reason=not_configured", async () => {
    vi.mocked(auth.getReviewRequestAccess).mockResolvedValue({
      authorized: false,
      reason: "not_configured",
      viewer: null,
    });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Happy path + status derivation
// ---------------------------------------------------------------------------

describe("GET /api/maxwell/admin/llm-budget — payload", () => {
  it("returns snake_case payload with cap + total + ratio + thresholds", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      period_month: "2026-05-01",
      cap_usd: 200,
      total_usd: 25,
      ratio: 0.125,
      call_count: 42,
      by_category: { chat: 20, brief_extractor: 5 },
      by_provider: { openai: 25 },
      thresholds: {
        warn_at_ratio: 0.5,
        critical_at_ratio: 0.8,
        hard_stop_at_ratio: 1.0,
      },
      status: "ok",
    });
  });

  it("sets Cache-Control: no-store", async () => {
    const res = await GET(req());
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    [0, "ok"],
    [0.49, "ok"],
    [0.5, "warn"],
    [0.79, "warn"],
    [0.8, "critical"],
    [0.99, "critical"],
    [1.0, "hard_stop"],
    [1.5, "hard_stop"],
  ])("derives status='%s' when ratio=%s", async (ratio, expectedStatus) => {
    vi.mocked(budget.getMonthlyUsage).mockResolvedValue({
      capUsd: 200,
      totalUsd: 200 * ratio,
      ratio,
      byCategory: {},
      byProvider: {},
      callCount: 0,
      periodMonth: "2026-05-01",
    });

    const res = await GET(req());
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe(expectedStatus);
  });
});

// ---------------------------------------------------------------------------
// Failure
// ---------------------------------------------------------------------------

describe("GET /api/maxwell/admin/llm-budget — failure", () => {
  it("returns 503 with code LLM_BUDGET_DATA_UNAVAILABLE when getMonthlyUsage throws", async () => {
    vi.mocked(budget.getMonthlyUsage).mockRejectedValue(
      new Error('relation "llm_budget_usage" does not exist'),
    );

    const res = await GET(req());
    expect(res.status).toBe(503);

    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("LLM_BUDGET_DATA_UNAVAILABLE");
    // The error message should be friendly — does NOT leak the SQL detail.
    expect(body.message).not.toContain("relation");
    // And the message should reassure ops that Maxwell is still up.
    expect(body.message).toMatch(/unaffected/i);
  });
});
