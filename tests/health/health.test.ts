/**
 * tests/health/health.test.ts
 *
 * Tests the public minimal health endpoint at `/api/health`.
 * Public (no auth). Returns 200 when the database round-trip succeeds, 503 otherwise.
 * Used by uptime monitors (UptimeRobot etc.) — must stay binary and small.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbQuery = vi.fn();

vi.mock("@/lib/server/db", () => ({
  getDb: () => mockDbQuery,
}));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    mockDbQuery.mockReset();
  });

  it("returns 200 with healthy=true when the database round-trip succeeds", async () => {
    mockDbQuery.mockResolvedValue([{ ok: 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.healthy).toBe(true);
    expect(body.service).toBe("api");
    expect(typeof body.checked_at).toBe("string");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 503 with healthy=false when the database round-trip fails", async () => {
    mockDbQuery.mockRejectedValue(new Error("DB down"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.healthy).toBe(false);
  });

  it("does not expose per-dependency detail (no OpenAI / V0 / env signal)", async () => {
    mockDbQuery.mockResolvedValue([{ ok: 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(body).not.toHaveProperty("dependencies");
    expect(body).not.toHaveProperty("openai");
    expect(body).not.toHaveProperty("v0");
  });
});
