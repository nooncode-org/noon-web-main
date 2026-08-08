/**
 * tests/maxwell/data-retention.test.ts
 *
 * The sweep that makes the portal's twelve-month promise true — and the only
 * code in this repo that deletes a client's project without a human asking.
 *
 * So the tests are weighted towards the ways it must REFUSE to act. Anyone can
 * write the happy path; what protects a client is that an unset variable, a
 * typo, a still-warm membership or a runaway query all end in "nothing was
 * touched".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sqlMock = vi.fn();

vi.mock("@/lib/server/db", () => ({
  getDb: () => sqlMock,
}));

vi.mock("@/lib/server/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  MAX_PER_SWEEP,
  readRetentionMonths,
  retentionCutoff,
  runDataRetentionSweep,
} from "@/lib/maxwell/data-retention";

/** A workspace row as the sweep's SELECT returns it. */
function row(id: string, endedAt: string) {
  return { studio_session_id: `sess-${id}`, id, membership_ended_at: endedAt };
}

/**
 * Queue one result per QUERY.
 *
 * postgres.js is used two ways in the same statement: as a tagged template for
 * the query itself, and as a plain call — `sql(ids)` — to build the IN list.
 * Both land on the same mock, so a naive queue hands the DELETE's result to the
 * id-list helper and the sweep reports zero deletions. Telling them apart by
 * the tagged-template signature is what makes the counts mean anything.
 */
function queueResults(...results: unknown[][]) {
  sqlMock.mockReset();
  const queue = [...results];
  sqlMock.mockImplementation((first: unknown) => {
    const isTaggedTemplate = Array.isArray(first) && "raw" in Object(first);
    if (!isTaggedTemplate) return []; // sql(ids) — just a fragment
    return Promise.resolve(queue.shift() ?? []);
  });
}

/** Only the real queries, not the id-list fragments. */
function queryCount() {
  return sqlMock.mock.calls.filter(
    (call) => Array.isArray(call[0]) && "raw" in Object(call[0]),
  ).length;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.DATA_RETENTION_MONTHS;
  delete process.env.DATA_RETENTION_APPLY;
  sqlMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("readRetentionMonths — the switch", () => {
  it("is off when nothing is configured", () => {
    expect(readRetentionMonths(undefined)).toBeNull();
    expect(readRetentionMonths("")).toBeNull();
    expect(readRetentionMonths("   ")).toBeNull();
  });

  it("is off for anything that isn't a positive whole number", () => {
    // A typo in an env var must not be what starts deleting projects, so every
    // one of these reads as OFF rather than falling back to a default.
    for (const bad of ["twelve", "12 months", "0", "-6", "1.5", "NaN", "1e3x"]) {
      expect(readRetentionMonths(bad), `"${bad}" should be off`).toBeNull();
    }
  });

  it("accepts a positive whole number of months", () => {
    expect(readRetentionMonths("12")).toBe(12);
    expect(readRetentionMonths(" 6 ")).toBe(6);
  });
});

describe("retentionCutoff", () => {
  it("walks back the given number of months", () => {
    const now = new Date("2027-03-15T10:00:00.000Z");
    expect(retentionCutoff(12, now).toISOString()).toBe("2026-03-15T10:00:00.000Z");
    expect(retentionCutoff(6, now).toISOString()).toBe("2026-09-15T10:00:00.000Z");
  });

  it("does not mutate the date it was handed", () => {
    const now = new Date("2027-03-15T10:00:00.000Z");
    retentionCutoff(12, now);
    expect(now.toISOString()).toBe("2027-03-15T10:00:00.000Z");
  });
});

describe("runDataRetentionSweep", () => {
  it("touches nothing at all when the feature is unset", async () => {
    const report = await runDataRetentionSweep();

    expect(report.enabled).toBe(false);
    expect(report.deleted).toBe(0);
    // The strongest assertion in the file: it never even asked the database.
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("reports without deleting when only the clock is on", async () => {
    process.env.DATA_RETENTION_MONTHS = "12";
    queueResults([row("ws-1", "2025-01-01T00:00:00.000Z")]);

    const report = await runDataRetentionSweep({ now: new Date("2027-01-01T00:00:00.000Z") });

    expect(report.enabled).toBe(true);
    expect(report.applied).toBe(false);
    expect(report.candidates).toHaveLength(1);
    expect(report.candidates[0].studioSessionId).toBe("sess-ws-1");
    expect(report.deleted).toBe(0);
    // One call: the SELECT. No DELETE was issued.
    expect(queryCount()).toBe(1);
  });

  it("deletes only when told a second time", async () => {
    process.env.DATA_RETENTION_MONTHS = "12";
    process.env.DATA_RETENTION_APPLY = "1";
    queueResults([row("ws-1", "2025-01-01T00:00:00.000Z")], [{ id: "sess-ws-1" }]);

    const report = await runDataRetentionSweep({ now: new Date("2027-01-01T00:00:00.000Z") });

    expect(report.applied).toBe(true);
    expect(report.deleted).toBe(1);
  });

  it("does not fire a DELETE when nothing has expired", async () => {
    process.env.DATA_RETENTION_MONTHS = "12";
    process.env.DATA_RETENTION_APPLY = "1";
    queueResults([]);

    const report = await runDataRetentionSweep({ now: new Date("2027-01-01T00:00:00.000Z") });

    expect(report.deleted).toBe(0);
    expect(queryCount()).toBe(1);
  });

  it("caps one run and says how much it left behind", async () => {
    process.env.DATA_RETENTION_MONTHS = "12";
    // The query asks for one more than the cap so the sweep can tell "exactly
    // full" from "there is more". A wrong cutoff should cost a bounded mistake.
    const tooMany = Array.from({ length: MAX_PER_SWEEP + 1 }, (_, i) =>
      row(`ws-${i}`, "2025-01-01T00:00:00.000Z"),
    );
    queueResults(tooMany);

    const report = await runDataRetentionSweep({ now: new Date("2027-01-01T00:00:00.000Z") });

    expect(report.candidates).toHaveLength(MAX_PER_SWEEP);
    expect(report.remaining).toBe(1);
  });

  it("treats any value other than exactly \"1\" as do-not-delete", async () => {
    process.env.DATA_RETENTION_MONTHS = "12";
    for (const value of ["true", "yes", "0", "", "ON"]) {
      process.env.DATA_RETENTION_APPLY = value;
      queueResults([row("ws-1", "2025-01-01T00:00:00.000Z")]);

      const report = await runDataRetentionSweep({ now: new Date("2027-01-01T00:00:00.000Z") });
      expect(report.applied, `"${value}" must not delete`).toBe(false);
      expect(report.deleted).toBe(0);
    }
  });
});
