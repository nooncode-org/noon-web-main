/**
 * tests/maxwell/prototype-guards.test.ts
 *
 * Fase A · E3.3 — the two guards with real decision logic:
 *
 *   - the PER-PROTOTYPE spend ceiling (the monthly cap protects the month;
 *     this one stops a single runaway generation), including its rule that
 *     an unreadable ledger must never block a client's prototype;
 *   - the periodic re-visit that refreshes EXPIRED fichas only, oldest
 *     first, capped per run, and keeps the old ficha when a re-study fails
 *     (stale beats none).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/maxwell/reference-study/measure", () => ({ measureReference: vi.fn() }));
vi.mock("@/lib/maxwell/reference-study/dossier", () => ({ buildReferenceDossier: vi.fn() }));
vi.mock("@/lib/maxwell/reference-study/dossier-cache", () => ({
  readCachedDossier: vi.fn(),
  writeCachedDossier: vi.fn(async () => undefined),
  isDossierStale: vi.fn(),
}));

import { getDb } from "@/lib/server/db";
import {
  assertPrototypeBudgetAvailable,
  resolvePrototypeCapUsd,
  sessionSpendLastHourUsd,
  LLMBudgetExceededError,
} from "@/lib/server/llm-budget";
import { refreshStaleDossiers } from "@/lib/maxwell/reference-study/refresh";
import {
  isDossierStale,
  readCachedDossier,
  writeCachedDossier,
} from "@/lib/maxwell/reference-study/dossier-cache";
import { measureReference } from "@/lib/maxwell/reference-study/measure";
import { buildReferenceDossier } from "@/lib/maxwell/reference-study/dossier";

/** postgres.js is a tagged template — the mock just answers with `rows`. */
function ledgerReturning(total: number | null) {
  vi.mocked(getDb).mockReturnValue(
    (async () => [{ total }]) as unknown as ReturnType<typeof getDb>,
  );
}

describe("per-prototype spend ceiling", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("defaults to $0.60 and takes an env override", () => {
    expect(resolvePrototypeCapUsd()).toBeCloseTo(0.6);
    vi.stubEnv("LLM_BUDGET_USD_PER_PROTOTYPE", "1.25");
    expect(resolvePrototypeCapUsd()).toBeCloseTo(1.25);
    // Nonsense values fall back instead of disabling the ceiling.
    vi.stubEnv("LLM_BUDGET_USD_PER_PROTOTYPE", "-3");
    expect(resolvePrototypeCapUsd()).toBeCloseTo(0.6);
  });

  it("lets a normal run through", async () => {
    ledgerReturning(0.08);
    await expect(assertPrototypeBudgetAvailable("session-1")).resolves.toBeUndefined();
  });

  it("stops a runaway generation", async () => {
    ledgerReturning(0.9);
    await expect(assertPrototypeBudgetAvailable("session-1")).rejects.toBeInstanceOf(
      LLMBudgetExceededError,
    );
  });

  it("never blocks the client when the ledger cannot be read", async () => {
    vi.mocked(getDb).mockImplementation(() => {
      throw new Error("db down");
    });
    await expect(sessionSpendLastHourUsd("session-1")).resolves.toBe(0);
    await expect(assertPrototypeBudgetAvailable("session-1")).resolves.toBeUndefined();
  });
});

describe("periodic ficha refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes only EXPIRED fichas, and caps how many per run", async () => {
    // Every pool reference has a cached ficha, and all of them are stale.
    vi.mocked(readCachedDossier).mockResolvedValue({
      dossier: { version: 1 } as never,
      cachedAt: "2026-01-01T00:00:00Z",
    });
    vi.mocked(isDossierStale).mockReturnValue(true);
    vi.mocked(measureReference).mockResolvedValue({ url: "x" } as never);
    vi.mocked(buildReferenceDossier).mockResolvedValue({ version: 1 } as never);

    const report = await refreshStaleDossiers(2);

    expect(report.checked).toBeGreaterThan(2);
    expect(report.stale).toBe(report.checked);
    expect(report.refreshed).toBe(2); // the cap, not the whole pool
    expect(writeCachedDossier).toHaveBeenCalledTimes(2);
  });

  it("does nothing when no ficha has expired", async () => {
    vi.mocked(readCachedDossier).mockResolvedValue({
      dossier: { version: 1 } as never,
      cachedAt: new Date().toISOString(),
    });
    vi.mocked(isDossierStale).mockReturnValue(false);

    const report = await refreshStaleDossiers(3);

    expect(report.stale).toBe(0);
    expect(report.refreshed).toBe(0);
    expect(measureReference).not.toHaveBeenCalled();
  });

  it("keeps the old ficha when a re-study fails (stale beats none)", async () => {
    vi.mocked(readCachedDossier).mockResolvedValue({
      dossier: { version: 1 } as never,
      cachedAt: "2026-01-01T00:00:00Z",
    });
    vi.mocked(isDossierStale).mockReturnValue(true);
    vi.mocked(measureReference).mockRejectedValue(new Error("net::ERR_FAILED"));

    const report = await refreshStaleDossiers(1);

    expect(report.failed).toBe(1);
    expect(report.refreshed).toBe(0);
    expect(writeCachedDossier).not.toHaveBeenCalled();
  });

  it("ignores references that were never studied — those are not stale", async () => {
    vi.mocked(readCachedDossier).mockResolvedValue(null);

    const report = await refreshStaleDossiers(3);

    expect(report.checked).toBeGreaterThan(0);
    expect(report.stale).toBe(0);
    expect(measureReference).not.toHaveBeenCalled();
  });
});
