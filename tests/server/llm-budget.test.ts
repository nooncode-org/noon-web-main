/**
 * tests/server/llm-budget.test.ts
 *
 * G-D2 — tests for the monthly LLM-budget tracker.
 *
 * Mocked: `getDb` (postgres.js client) and `log`. The pricing module
 * runs real because it's a pure lookup.
 *
 * Coverage:
 *   - resolveMonthlyBudgetUsd: default $200, env override, invalid env
 *     falls back to default with warning
 *   - assertBudgetAvailable: passes under cap; throws
 *     LLMBudgetExceededError at/over cap; warn-log at 50% / 80%
 *   - recordLLMCall: inserts a row with calculated cost; unknown model
 *     records cost=0 + warns; DB failure logged + swallowed
 *   - getMonthlyUsage: aggregates totals + byCategory + byProvider
 *   - currentPeriodMonth (indirect): produces YYYY-MM-01 in UTC
 *
 * Pricing math sanity checks pinned alongside (so a future pricing
 * table edit that drifts is caught by these tests, not by ops on the
 * next bill).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/server/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import * as db from "@/lib/server/db";
import * as logger from "@/lib/server/logger";
import {
  LLMBudgetExceededError,
  assertBudgetAvailable,
  getMonthlyUsage,
  recordLLMCall,
  resolveMonthlyBudgetUsd,
} from "@/lib/server/llm-budget";
import { estimateCallCostUsd } from "@/lib/server/llm-pricing";

// ---------------------------------------------------------------------------
// SQL mock harness
//
// postgres.js is invoked as a tagged template: `sql\`SELECT ...\``. We model
// it as a function that returns an array (the query result). For
// `sql.begin(async (tx) => ...)` we pass a sql-like callable to the
// callback. Each test sets up `queueRows` to control what each query
// returns in order.
// ---------------------------------------------------------------------------

let queuedResults: unknown[][] = [];
let executedQueries: string[] = [];

function makeSqlMock() {
  const sqlFn = vi.fn(async () => {
    // Tagged-template args (strings array + interpolations) are intentionally
    // ignored — tests assert via the queuedResults FIFO instead of inspecting
    // the SQL text. This keeps the mock decoupled from postgres.js syntax.
    executedQueries.push("query");
    return queuedResults.shift() ?? [];
  }) as unknown as ((...args: unknown[]) => Promise<unknown[]>) & {
    begin: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  };

  sqlFn.begin = async (cb) => {
    // Pass the same sqlFn as the transaction handle.
    return cb(sqlFn);
  };

  return sqlFn;
}

beforeEach(() => {
  queuedResults = [];
  executedQueries = [];
  vi.clearAllMocks();
  vi.mocked(db.getDb).mockReturnValue(makeSqlMock() as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// resolveMonthlyBudgetUsd
// ---------------------------------------------------------------------------

describe("resolveMonthlyBudgetUsd", () => {
  it("defaults to $200 when LLM_BUDGET_USD_PER_MONTH is unset", () => {
    vi.stubEnv("LLM_BUDGET_USD_PER_MONTH", "");
    expect(resolveMonthlyBudgetUsd()).toBe(200);
  });

  it("honors a positive numeric env value", () => {
    vi.stubEnv("LLM_BUDGET_USD_PER_MONTH", "500");
    expect(resolveMonthlyBudgetUsd()).toBe(500);
  });

  it("falls back to default with a warning when env is non-numeric", () => {
    vi.stubEnv("LLM_BUDGET_USD_PER_MONTH", "lots");
    expect(resolveMonthlyBudgetUsd()).toBe(200);
    expect(logger.log.warn).toHaveBeenCalled();
  });

  it("falls back to default when env is zero or negative", () => {
    vi.stubEnv("LLM_BUDGET_USD_PER_MONTH", "-50");
    expect(resolveMonthlyBudgetUsd()).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// estimateCallCostUsd (pure pricing math sanity)
// ---------------------------------------------------------------------------

describe("estimateCallCostUsd — sanity pinning", () => {
  it("gpt-5.5 1000 input + 500 output ≈ $0.02 (5/M + 30/M)", () => {
    const { cost, priceLookupSucceeded } = estimateCallCostUsd({
      provider: "openai",
      model: "gpt-5.5",
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(priceLookupSucceeded).toBe(true);
    // 1000 * 5 / 1e6 = 0.005; 500 * 30 / 1e6 = 0.015; total = 0.02
    expect(cost).toBeCloseTo(0.02, 5);
  });

  it("v0:default returns the flat per-call estimate", () => {
    const { cost, priceLookupSucceeded } = estimateCallCostUsd({
      provider: "v0",
      model: "default",
    });
    expect(priceLookupSucceeded).toBe(true);
    expect(cost).toBe(0.3);
  });

  it("anthropic claude-opus-4 100k input + 10k output ≈ $2.25 (15/M + 75/M)", () => {
    const { cost, priceLookupSucceeded } = estimateCallCostUsd({
      provider: "anthropic",
      model: "claude-opus-4",
      inputTokens: 100_000,
      outputTokens: 10_000,
    });
    expect(priceLookupSucceeded).toBe(true);
    // 100000 * 15 / 1e6 = 1.5; 10000 * 75 / 1e6 = 0.75; total = 2.25
    expect(cost).toBeCloseTo(2.25, 5);
  });

  it("unknown model returns cost=0 + priceLookupSucceeded=false", () => {
    const { cost, priceLookupSucceeded } = estimateCallCostUsd({
      provider: "openai",
      model: "gpt-99-unicorn",
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(cost).toBe(0);
    expect(priceLookupSucceeded).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// assertBudgetAvailable
// ---------------------------------------------------------------------------

describe("assertBudgetAvailable", () => {
  it("passes silently when current spend is under 50%", async () => {
    // Mock: advisory lock returns [] (any non-error), SUM returns $50 of $200.
    queuedResults = [
      [{ pg_advisory_xact_lock: "" }],
      [{ total: "50" }],
    ];

    await expect(assertBudgetAvailable()).resolves.toBeUndefined();
    expect(logger.log.warn).not.toHaveBeenCalled();
    expect(logger.log.error).not.toHaveBeenCalled();
  });

  it("logs WARN at the 50% threshold", async () => {
    queuedResults = [
      [{ pg_advisory_xact_lock: "" }],
      [{ total: "100" }], // exactly 50% of $200
    ];

    await assertBudgetAvailable();
    expect(logger.log.warn).toHaveBeenCalledWith(
      "llm-budget",
      expect.stringMatching(/50%/),
      expect.objectContaining({ total_usd: 100, cap_usd: 200 }),
    );
  });

  it("logs ERROR (critical) at the 80% threshold", async () => {
    queuedResults = [
      [{ pg_advisory_xact_lock: "" }],
      [{ total: "160" }], // exactly 80% of $200
    ];

    await assertBudgetAvailable();
    expect(logger.log.error).toHaveBeenCalledWith(
      "llm-budget",
      expect.stringMatching(/80%/),
      expect.objectContaining({ severity: "critical" }),
    );
  });

  it("throws LLMBudgetExceededError at 100% (>= cap)", async () => {
    queuedResults = [
      [{ pg_advisory_xact_lock: "" }],
      [{ total: "200" }], // exactly at cap
    ];

    await expect(assertBudgetAvailable()).rejects.toBeInstanceOf(
      LLMBudgetExceededError,
    );
  });

  it("throws when over cap (e.g. $210 spent)", async () => {
    queuedResults = [
      [{ pg_advisory_xact_lock: "" }],
      [{ total: "210" }],
    ];

    await expect(assertBudgetAvailable()).rejects.toThrow(
      /LLM monthly budget exceeded.*\$210\.00.*\$200\.00/,
    );
  });

  it("treats null SUM (empty month) as $0", async () => {
    queuedResults = [
      [{ pg_advisory_xact_lock: "" }],
      [{ total: null }],
    ];

    await expect(assertBudgetAvailable()).resolves.toBeUndefined();
    expect(logger.log.warn).not.toHaveBeenCalled();
  });

  it("honors the env override for the cap", async () => {
    vi.stubEnv("LLM_BUDGET_USD_PER_MONTH", "50");
    queuedResults = [
      [{ pg_advisory_xact_lock: "" }],
      [{ total: "30" }], // 60% of $50 → warn but not error
    ];

    await assertBudgetAvailable();
    expect(logger.log.warn).toHaveBeenCalled();
  });

  it("FAILS OPEN when the DB query errors (e.g. table missing)", async () => {
    // Simulate a SQL error — the table doesn't exist, transient DB
    // hiccup, or migration 017 hasn't been applied yet. Worst-case
    // realistic scenario: G-D2 deployed but the migration is still in
    // the ops queue.
    const failingSql = vi.fn(async () => {
      throw new Error(
        'relation "llm_budget_usage" does not exist',
      );
    }) as unknown as ((...args: unknown[]) => Promise<unknown[]>) & {
      begin: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
    };
    failingSql.begin = async (cb) => cb(failingSql);
    vi.mocked(db.getDb).mockReturnValue(failingSql as never);

    // MUST NOT throw. The LLM call must proceed (the B11 prototype-quota
    // is the real safety net; this check is anomaly detection).
    await expect(assertBudgetAvailable()).resolves.toBeUndefined();

    // BUT it should log loud at error level so ops sees the issue
    // immediately in Sentry / Vercel logs.
    expect(logger.log.error).toHaveBeenCalledWith(
      "llm-budget",
      expect.any(Error),
      expect.objectContaining({
        phase: "assert_budget_available",
        decision: "fail_open",
      }),
    );
  });

  it("STILL throws LLMBudgetExceededError when over cap (vs swallowing it)", async () => {
    // Regression guard: the fail-open behaviour above must NOT swallow
    // the legitimate budget-exceeded signal. Only DB errors fail open.
    queuedResults = [
      [{ pg_advisory_xact_lock: "" }],
      [{ total: "250" }], // 125% of $200
    ];

    await expect(assertBudgetAvailable()).rejects.toBeInstanceOf(
      LLMBudgetExceededError,
    );
  });
});

// ---------------------------------------------------------------------------
// recordLLMCall
// ---------------------------------------------------------------------------

describe("recordLLMCall", () => {
  it("inserts a row with the calculated cost", async () => {
    queuedResults = [[]]; // INSERT returns nothing

    await recordLLMCall({
      category: "chat",
      provider: "openai",
      model: "gpt-5.5",
      inputTokens: 1000,
      outputTokens: 500,
      requestId: "session-1:turn-3",
      metadata: { finish_reason: "stop" },
    });

    // Successful: no warn / error
    expect(logger.log.warn).not.toHaveBeenCalled();
    expect(logger.log.error).not.toHaveBeenCalled();
    expect(executedQueries).toHaveLength(1);
  });

  it("warns when the model is unknown but still inserts the row (cost=0)", async () => {
    queuedResults = [[]];

    await recordLLMCall({
      category: "chat",
      provider: "openai",
      model: "gpt-99-unicorn",
      inputTokens: 1000,
      outputTokens: 500,
    });

    expect(logger.log.warn).toHaveBeenCalledWith(
      "llm-budget",
      expect.stringMatching(/unknown model/i),
      expect.any(Object),
    );
    expect(executedQueries).toHaveLength(1);
  });

  it("swallows DB errors (does NOT throw) and logs them", async () => {
    // Make sql throw on the INSERT
    const failingSql = vi.fn(async () => {
      throw new Error("DB timeout");
    }) as unknown as never;
    vi.mocked(db.getDb).mockReturnValue(failingSql);

    await expect(
      recordLLMCall({
        category: "chat",
        provider: "openai",
        model: "gpt-5.5",
        inputTokens: 100,
        outputTokens: 50,
      }),
    ).resolves.toBeUndefined();

    expect(logger.log.error).toHaveBeenCalledWith(
      "llm-budget",
      expect.any(Error),
      expect.objectContaining({ phase: "record_llm_call" }),
    );
  });
});

// ---------------------------------------------------------------------------
// getMonthlyUsage
// ---------------------------------------------------------------------------

describe("getMonthlyUsage", () => {
  it("aggregates totals + byCategory + byProvider", async () => {
    queuedResults = [
      [{ total: "75.50" }], // SUM
      // GROUP BY category
      [
        { category: "chat", total: "50" },
        { category: "brief_extractor", total: "20" },
        { category: "v0_prototype_create", total: "5.5" },
      ],
      // GROUP BY provider
      [
        { provider: "openai", total: "70" },
        { provider: "v0", total: "5.5" },
      ],
      // COUNT(*)
      [{ c: "23" }],
    ];

    const usage = await getMonthlyUsage();

    expect(usage.totalUsd).toBe(75.5);
    expect(usage.capUsd).toBe(200);
    expect(usage.ratio).toBeCloseTo(0.3775, 4);
    expect(usage.callCount).toBe(23);
    expect(usage.byCategory).toEqual({
      chat: 50,
      brief_extractor: 20,
      v0_prototype_create: 5.5,
    });
    expect(usage.byProvider).toEqual({
      openai: 70,
      v0: 5.5,
    });
    expect(usage.periodMonth).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it("returns 0 totals for an empty month", async () => {
    queuedResults = [
      [{ total: null }],
      [],
      [],
      [{ c: "0" }],
    ];

    const usage = await getMonthlyUsage();
    expect(usage.totalUsd).toBe(0);
    expect(usage.callCount).toBe(0);
    expect(usage.byCategory).toEqual({});
    expect(usage.byProvider).toEqual({});
  });
});
