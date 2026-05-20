/**
 * app/api/maxwell/admin/llm-budget/route.ts
 *
 * G-D2 — Ops dashboard endpoint for the monthly LLM budget tracker.
 *
 * GET /api/maxwell/admin/llm-budget
 *   Returns the current month's spend aggregated by category +
 *   provider, plus the cap and ratio. Read-only. Internal use only.
 *
 * Auth:
 *   Uses the same `getReviewRequestAccess` pattern as the rest of
 *   the /maxwell/review surfaces — REVIEW_API_SECRET Bearer OR a
 *   session viewer in REVIEW_ALLOWED_EMAILS. This keeps the budget
 *   visibility behind the same gate as other ops surfaces; the
 *   public client should never see it.
 *
 * Failure modes:
 *   - DB error → 503 with a clear code so the dashboard shows a
 *     "data unavailable" state instead of a generic crash. The
 *     hot path (assertBudgetAvailable in lib/server/llm-budget.ts)
 *     fails open on the same DB error, so Maxwell stays UP even
 *     when this dashboard view is unavailable.
 *   - Migration 017 not yet applied → 503 with the same code; the
 *     log line includes the SQL error so ops can diagnose.
 *
 * No cache headers needed — Next defaults plus `force-dynamic` give
 * us per-request server rendering, which is what we want for a
 * tracker that moves every minute.
 */

import { NextResponse } from "next/server";
import { getReviewRequestAccess } from "@/lib/auth/review";
import { getMonthlyUsage } from "@/lib/server/llm-budget";
import { log } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await getReviewRequestAccess(request);
  if (!access.authorized) {
    const status = access.reason === "sign_in_required" ? 401 : 403;
    return NextResponse.json({ message: "Unauthorized." }, { status });
  }

  try {
    const usage = await getMonthlyUsage();
    return NextResponse.json(
      {
        // Snake-case keys for consistency with other admin endpoints.
        period_month: usage.periodMonth,
        cap_usd: usage.capUsd,
        total_usd: usage.totalUsd,
        ratio: usage.ratio,
        call_count: usage.callCount,
        by_category: usage.byCategory,
        by_provider: usage.byProvider,
        // Convenience flags for the dashboard UI — saves the client
        // from re-implementing the same thresholds defined in
        // lib/server/llm-budget.ts.
        thresholds: {
          warn_at_ratio: 0.5,
          critical_at_ratio: 0.8,
          hard_stop_at_ratio: 1.0,
        },
        status:
          usage.ratio >= 1.0
            ? "hard_stop"
            : usage.ratio >= 0.8
              ? "critical"
              : usage.ratio >= 0.5
                ? "warn"
                : "ok",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    log.error("maxwell.admin.llm-budget", error);
    return NextResponse.json(
      {
        message:
          "LLM budget data is temporarily unavailable. The hot path (Maxwell calls) is unaffected.",
        code: "LLM_BUDGET_DATA_UNAVAILABLE",
      },
      { status: 503 },
    );
  }
}
