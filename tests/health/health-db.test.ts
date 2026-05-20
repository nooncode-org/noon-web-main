/**
 * tests/health/health-db.test.ts
 *
 * Coverage for `GET /api/health/db` — the database connectivity probe
 * used by UptimeRobot / Vercel monitoring.
 *
 * Mocks: `getDb` (the postgres.js client factory). The latency math,
 * error-shape extraction, and Cache-Control header construction run
 * real so a regression in any of those surfaces here.
 *
 * Coverage matrix:
 *   - Healthy path: SELECT 1 succeeds → 200 with healthy=true +
 *     latency_ms + ISO timestamp
 *   - Connect failure (Error subclass): SELECT throws → 503 with
 *     healthy=false + extracted message
 *   - Postgres error with .code property: 503 with error_code captured
 *   - Non-Error object thrown: 503 with fallback "Unknown database
 *     error." message
 *   - Cache-Control: no-store on every response (monitors should not
 *     cache health checks)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/db", () => ({
  getDb: vi.fn(),
}));

import * as db from "@/lib/server/db";
import { GET } from "@/app/api/health/db/route";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("GET /api/health/db — healthy", () => {
  it("returns 200 with healthy=true when SELECT 1 succeeds", async () => {
    const sqlMock = vi.fn(async () => [{ ok: 1 }]);
    vi.mocked(db.getDb).mockReturnValue(sqlMock as never);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      service: string;
      healthy: boolean;
      latency_ms: number;
      checked_at: string;
    };
    expect(body.service).toBe("database");
    expect(body.healthy).toBe(true);
    expect(body.latency_ms).toBeGreaterThanOrEqual(0);
    expect(body.checked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601 start

    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

// ---------------------------------------------------------------------------
// Unhealthy — various error shapes
// ---------------------------------------------------------------------------

describe("GET /api/health/db — unhealthy", () => {
  it("returns 503 with healthy=false + message when SELECT throws an Error", async () => {
    const sqlMock = vi.fn(async () => {
      throw new Error("connection refused at host:5432");
    });
    vi.mocked(db.getDb).mockReturnValue(sqlMock as never);

    const res = await GET();
    expect(res.status).toBe(503);

    const body = (await res.json()) as {
      service: string;
      healthy: boolean;
      message: string;
      error_code: string | null;
    };
    expect(body.service).toBe("database");
    expect(body.healthy).toBe(false);
    expect(body.message).toBe("connection refused at host:5432");
    expect(body.error_code).toBeNull();

    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("captures the .code property when postgres throws a coded error", async () => {
    // postgres.js errors carry SQLSTATE codes on .code (e.g. 42P01 =
    // undefined_table, 28P01 = invalid_password).
    const pgError = Object.assign(new Error("relation does not exist"), {
      code: "42P01",
    });
    const sqlMock = vi.fn(async () => {
      throw pgError;
    });
    vi.mocked(db.getDb).mockReturnValue(sqlMock as never);

    const res = await GET();
    expect(res.status).toBe(503);

    const body = (await res.json()) as { error_code: string | null; message: string };
    expect(body.error_code).toBe("42P01");
    expect(body.message).toBe("relation does not exist");
  });

  it("uses fallback message when a non-Error value is thrown", async () => {
    // Unusual but possible — some libs throw bare objects or strings.
    const sqlMock = vi.fn(async () => {
      throw "totally bare string";
    });
    vi.mocked(db.getDb).mockReturnValue(sqlMock as never);

    const res = await GET();
    expect(res.status).toBe(503);

    const body = (await res.json()) as { message: string; error_code: string | null };
    expect(body.message).toBe("Unknown database error.");
    expect(body.error_code).toBeNull();
  });
});
