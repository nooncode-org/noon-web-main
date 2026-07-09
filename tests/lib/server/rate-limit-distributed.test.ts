/**
 * SEC-M5 (auditoría 2026-07) — capa distribuida del rate-limit.
 *
 * La atomicidad del INSERT ... ON CONFLICT la garantiza Postgres; aquí se
 * pinnea el CONTRATO del helper: qué SQL-shape recibe (identidad hasheada,
 * nunca IP cruda), el veredicto según `hits`, el fail-open ante error de DB,
 * y el short-circuit de la capa 1 (bucket in-memory) que evita el round-trip.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sqlMock = vi.fn();

vi.mock("@/lib/server/db", () => ({
  getDb: () => sqlMock,
}));

vi.mock("@/lib/server/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  consumeDistributedToken,
  hashRateLimitIdentity,
} from "@/lib/server/rate-limit-distributed";
import { __resetRateLimitForTests } from "@/lib/server/rate-limit";

function mockHits(hits: number) {
  sqlMock.mockResolvedValue([{ hits }]);
}

beforeEach(() => {
  __resetRateLimitForTests();
  sqlMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("consumeDistributedToken", () => {
  it("allows when the shared counter is under the limit", async () => {
    mockHits(3);
    const result = await consumeDistributedToken({
      namespace: "test.public",
      identityKey: "203.0.113.7",
      limit: 30,
      windowSeconds: 60,
    });
    expect(result.ok).toBe(true);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("blocks when the shared counter exceeds the limit (cross-instance scanner)", async () => {
    mockHits(31);
    const result = await consumeDistributedToken({
      namespace: "test.public",
      identityKey: "203.0.113.7",
      limit: 30,
      windowSeconds: 60,
    });
    expect(result.ok).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(result.remaining).toBe(0);
  });

  it("hashes the identity before it reaches the SQL layer (privacy: no raw IPs at rest)", async () => {
    mockHits(1);
    const rawIp = "203.0.113.7";
    await consumeDistributedToken({
      namespace: "test.public",
      identityKey: rawIp,
      limit: 30,
      windowSeconds: 60,
    });

    // postgres.js tagged template: (strings, ...values). Values must carry the
    // 16-char hash, never the raw IP.
    const values = sqlMock.mock.calls[0].slice(1);
    expect(values).toContain(hashRateLimitIdentity(rawIp));
    expect(values).not.toContain(rawIp);
    expect(hashRateLimitIdentity(rawIp)).toHaveLength(16);
  });

  it("fails OPEN when the Postgres counter errors", async () => {
    sqlMock.mockRejectedValue(new Error("connection refused"));
    const result = await consumeDistributedToken({
      namespace: "test.public",
      identityKey: "203.0.113.7",
      limit: 30,
      windowSeconds: 60,
    });
    expect(result.ok).toBe(true);
  });

  it("layer 1 (in-memory bucket) short-circuits WITHOUT hitting the DB", async () => {
    mockHits(1);
    // Drain the local bucket: limit 2 per 60s → third call blocks locally.
    const opts = {
      namespace: "test.local-first",
      identityKey: "203.0.113.9",
      limit: 2,
      windowSeconds: 60,
    };
    expect((await consumeDistributedToken(opts)).ok).toBe(true);
    expect((await consumeDistributedToken(opts)).ok).toBe(true);
    const dbCallsBefore = sqlMock.mock.calls.length;

    const blocked = await consumeDistributedToken(opts);
    expect(blocked.ok).toBe(false);
    expect(sqlMock.mock.calls.length).toBe(dbCallsBefore);
  });
});
