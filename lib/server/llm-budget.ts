/**
 * lib/server/llm-budget.ts
 *
 * G-D2 — Monthly LLM-budget tracker.
 *
 * Records every LLM call (OpenAI, Anthropic, v0) and enforces a single
 * monthly hard-stop. Designed as ANOMALY DETECTION, not as throttle:
 * the real per-user / per-month throttle for Maxwell prototypes lives
 * in `lib/maxwell/prototype-quota.ts` (B11: GLOBAL_MONTHLY_INITIAL_PROTOTYPES
 * = 15, USER_MONTHLY_INITIAL_LIMIT = 1). With those caps, legitimate
 * monthly LLM spend tops out around $35-50/month. A $200/month hard-stop
 * (configurable) only ever fires when something abnormal is happening:
 *
 *   - Bug introduces a retry loop in chat/extractor/classifier
 *   - Abuse path bypasses the prototype quota
 *   - Provider price change without us noticing
 *
 * Soft alerts (50% + 80%) give early warning before the hard-stop hits.
 *
 * Multi-repo note: this tracker only sees what `noon-web-main` calls.
 * The App (App-nooncode) uses the same providers but has its own
 * separate tracker if any. Belt-and-suspenders: set a "Hard limit" in
 * the provider dashboard per-API-key so the provider itself rejects
 * calls past a chosen cap.
 *
 * Race-safety:
 *   `assertBudgetAvailable()` uses `pg_advisory_xact_lock` on a hash
 *   of the period_month string (same pattern as B11). Two concurrent
 *   POSTs cannot both pass the 100% check when total is at $199.99 —
 *   one waits while the other reads + decides, and if the first one's
 *   recorded cost pushes us over $200, the second receives the lock
 *   AFTER seeing the new total.
 *
 *   Note: `recordLLMCall()` itself does NOT take the lock — it just
 *   inserts a row. The lock guards the READ + DECISION, not the
 *   record. This is intentional: the record is best-effort
 *   (fire-and-forget); the decision is the safety-critical path.
 *
 * Failure modes:
 *   - DB down → `assertBudgetAvailable()` re-throws (request fails
 *     loud — better than silently letting spend explode)
 *   - DB down on `recordLLMCall()` → logged + swallowed (the actual
 *     LLM call already happened; failing the request because we
 *     couldn't log it would be punishing the wrong thing)
 *   - Unknown model in pricing table → cost recorded as 0 + warning
 *     logged. Caller's request still proceeds.
 */

import { getDb } from "@/lib/server/db";
import { log } from "@/lib/server/logger";
import {
  estimateCallCostUsd,
  type LLMProvider,
} from "@/lib/server/llm-pricing";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_BUDGET_USD_PER_MONTH = 200;
const WARN_50_THRESHOLD = 0.5;
const WARN_80_THRESHOLD = 0.8;

/**
 * Resolve the monthly cap from env (with fallback to default).
 * Re-read on every call so ops can flip `LLM_BUDGET_USD_PER_MONTH` in
 * Vercel without a redeploy (same pattern as `OPENAI_DEFAULT_MODEL`).
 */
export function resolveMonthlyBudgetUsd(): number {
  const raw = process.env.LLM_BUDGET_USD_PER_MONTH?.trim();
  if (!raw) return DEFAULT_BUDGET_USD_PER_MONTH;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    log.warn(
      "llm-budget",
      `LLM_BUDGET_USD_PER_MONTH is not a positive number: "${raw}". Falling back to default $${DEFAULT_BUDGET_USD_PER_MONTH}.`,
    );
    return DEFAULT_BUDGET_USD_PER_MONTH;
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class LLMBudgetExceededError extends Error {
  constructor(
    public readonly currentUsd: number,
    public readonly capUsd: number,
  ) {
    super(
      `LLM monthly budget exceeded: $${currentUsd.toFixed(2)} >= $${capUsd.toFixed(2)}.`,
    );
    this.name = "LLMBudgetExceededError";
  }
}

export type LLMCategory =
  | "chat"
  | "brief_extractor"
  | "style_classifier"
  | "proposal_generator"
  | "upgrade_analyzer"
  | "upgrade_generator"
  | "v0_prototype_create"
  | "v0_prototype_update"
  | "unlabeled";

export type RecordLLMCallInput = {
  category: LLMCategory;
  provider: LLMProvider;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  /** Stable id for tracing (e.g. `${studioSessionId}:${turnIndex}`). */
  requestId?: string | null;
  /** Small JSON payload (retry count, finish reason, etc.). NEVER include the prompt. */
  metadata?: Record<string, unknown>;
};

export type MonthlyUsage = {
  capUsd: number;
  totalUsd: number;
  ratio: number;
  byCategory: Record<string, number>;
  byProvider: Record<string, number>;
  callCount: number;
  periodMonth: string; // YYYY-MM-01
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Format Date → 'YYYY-MM-01' in UTC. Used as the period_month key.
 * UTC chosen for consistency with payment-event timestamps and to
 * avoid timezone-of-deploy drift.
 */
function currentPeriodMonth(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * Assert the monthly budget allows another LLM call. Throws
 * `LLMBudgetExceededError` if the current month's total >= cap.
 *
 * Uses an advisory lock so concurrent requests serialise around the
 * read + decision. Caller is expected to invoke this BEFORE the LLM
 * call and to surface a 503 to the client when it throws.
 *
 * Fail-open on DB errors (table missing, transient connectivity, etc.):
 *   This check is ANOMALY DETECTION, not a throttle. The real
 *   per-user / per-month cap lives in lib/maxwell/prototype-quota.ts
 *   (B11) and is enforced regardless of this function. If THIS check
 *   itself errors out (e.g. migration 017 hasn't been applied yet, or
 *   DB has a hiccup), we have two options:
 *
 *     (a) Throw → every Maxwell call fails with 500. Worst-case loss:
 *         business operations completely blocked until ops intervenes.
 *
 *     (b) Log critical + return (fail open) → the LLM call proceeds.
 *         Worst-case loss: a few extra dollars in spend while ops
 *         applies the migration / fixes the connectivity issue. The
 *         B11 prototype-quota still caps actual usage hard.
 *
 *   We pick (b). The cost asymmetry strongly favours fail-open.
 *
 *   The ONLY error we DO re-throw is the budget-exceeded one — that's
 *   a meaningful signal worth surfacing as a 503 to the client.
 */
export async function assertBudgetAvailable(): Promise<void> {
  const cap = resolveMonthlyBudgetUsd();
  const period = currentPeriodMonth();

  let result: { total: number };
  try {
    const sql = getDb();
    result = await sql.begin(async (tx) => {
      // Advisory lock keyed on the period month string. hashtext() turns
      // it into an int4 the advisory lock API expects. Same pattern as
      // B11 quota concurrency.
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`llm-budget:${period}`}))`;

      const rows = await tx<{ total: string | null }[]>`
        SELECT SUM(cost_usd) AS total
        FROM llm_budget_usage
        WHERE period_month = ${period}
      `;

      const total = Number(rows[0]?.total ?? 0);
      return { total };
    });
  } catch (error) {
    // Fail open — see the docblock for the rationale. Log at error
    // level so Sentry / Vercel logs surface this immediately. Common
    // causes: migration 017 not applied yet, transient DB hiccup,
    // schema drift. Ops should resolve and the next call will succeed.
    log.error("llm-budget", error, {
      phase: "assert_budget_available",
      period_month: period,
      decision: "fail_open",
      note: "Budget check could not run; allowing the LLM call. The B11 prototype-quota still enforces per-user caps.",
    });
    return;
  }

  const ratio = result.total / cap;

  if (result.total >= cap) {
    log.error("llm-budget", new LLMBudgetExceededError(result.total, cap), {
      total_usd: result.total,
      cap_usd: cap,
      period_month: period,
    });
    throw new LLMBudgetExceededError(result.total, cap);
  }

  if (ratio >= WARN_80_THRESHOLD) {
    log.error("llm-budget", `Reached ${(ratio * 100).toFixed(0)}% of monthly LLM budget.`, {
      total_usd: result.total,
      cap_usd: cap,
      ratio,
      period_month: period,
      severity: "critical",
    });
  } else if (ratio >= WARN_50_THRESHOLD) {
    log.warn("llm-budget", `Reached ${(ratio * 100).toFixed(0)}% of monthly LLM budget.`, {
      total_usd: result.total,
      cap_usd: cap,
      ratio,
      period_month: period,
    });
  }
}

/**
 * Record a single LLM call in the budget ledger. Fire-and-forget
 * pattern from the caller's perspective (you can `await` it but
 * failure to record never re-throws to the caller — the LLM call
 * already happened and the request must succeed).
 */
export async function recordLLMCall(input: RecordLLMCallInput): Promise<void> {
  const period = currentPeriodMonth();
  const { cost, priceLookupSucceeded } = estimateCallCostUsd({
    provider: input.provider,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
  });

  if (!priceLookupSucceeded) {
    log.warn("llm-budget", "Unknown model in pricing table — cost recorded as $0.", {
      provider: input.provider,
      model: input.model,
      category: input.category,
    });
  }

  try {
    const sql = getDb();
    const metadata = input.metadata ?? {};
    await sql`
      INSERT INTO llm_budget_usage (
        period_month, provider, model, category,
        input_tokens, output_tokens, cost_usd,
        request_id, metadata_json
      ) VALUES (
        ${period}, ${input.provider}, ${input.model}, ${input.category},
        ${input.inputTokens ?? null}, ${input.outputTokens ?? null}, ${cost},
        ${input.requestId ?? null}, ${JSON.stringify(metadata)}::jsonb
      )
    `;
  } catch (error) {
    // Best-effort log; do not re-throw. The LLM call already happened
    // upstream; failing the user's request because we couldn't ledger
    // the cost would be punishing the wrong thing.
    log.error("llm-budget", error, {
      phase: "record_llm_call",
      provider: input.provider,
      model: input.model,
      category: input.category,
    });
  }
}

/**
 * Aggregate spend for the current month. Used by the diagnostic /
 * dashboard query (ops endpoint, future PR). Pure read — no lock
 * needed; eventual consistency is acceptable for a dashboard.
 */
export async function getMonthlyUsage(): Promise<MonthlyUsage> {
  const cap = resolveMonthlyBudgetUsd();
  const period = currentPeriodMonth();
  const sql = getDb();

  const [totals, byCategory, byProvider, callCount] = await Promise.all([
    sql<{ total: string | null }[]>`
      SELECT SUM(cost_usd) AS total
      FROM llm_budget_usage
      WHERE period_month = ${period}
    `,
    sql<{ category: string; total: string }[]>`
      SELECT category, SUM(cost_usd) AS total
      FROM llm_budget_usage
      WHERE period_month = ${period}
      GROUP BY category
    `,
    sql<{ provider: string; total: string }[]>`
      SELECT provider, SUM(cost_usd) AS total
      FROM llm_budget_usage
      WHERE period_month = ${period}
      GROUP BY provider
    `,
    sql<{ c: string }[]>`
      SELECT COUNT(*) AS c
      FROM llm_budget_usage
      WHERE period_month = ${period}
    `,
  ]);

  const total = Number(totals[0]?.total ?? 0);
  return {
    capUsd: cap,
    totalUsd: total,
    ratio: cap > 0 ? total / cap : 0,
    byCategory: Object.fromEntries(byCategory.map((r) => [r.category, Number(r.total)])),
    byProvider: Object.fromEntries(byProvider.map((r) => [r.provider, Number(r.total)])),
    callCount: Number(callCount[0]?.c ?? 0),
    periodMonth: period,
  };
}
