/**
 * tests/health/health-detail.test.ts
 *
 * Tests the gated detail health endpoint at `/api/health/detail`.
 * Requires Authorization: Bearer <REVIEW_API_SECRET or CRON_SECRET> in production.
 * In non-production with no secrets configured, the gate is open (dev/CI convenience).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDbQuery = vi.fn();

vi.mock("@/lib/server/db", () => ({
  getDb: () => mockDbQuery,
}));

import { GET } from "@/app/api/health/detail/route";

function makeRequest(headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/health/detail", { headers });
}

// process.env.NODE_ENV is typed as readonly in @types/node. Tests need to flip it.
function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("GET /api/health/detail", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockDbQuery.mockReset();
    mockDbQuery.mockResolvedValue([{ ok: 1 }]);
    // Reset env to a clean known state for each test.
    delete process.env.REVIEW_API_SECRET;
    delete process.env.CRON_SECRET;
    delete process.env.OPENAI_API_KEY;
    delete process.env.V0_API_KEY;
    setNodeEnv("test");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 401 in production when no Authorization header and no secrets configured", async () => {
    setNodeEnv("production");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns 401 when secrets configured but wrong Authorization", async () => {
    process.env.REVIEW_API_SECRET = "real-secret";

    const response = await GET(makeRequest({ authorization: "Bearer wrong" }));

    expect(response.status).toBe(401);
  });

  it("returns 401 when secrets configured and no Authorization header", async () => {
    process.env.REVIEW_API_SECRET = "real-secret";

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
  });

  it("returns 200 with full detail when Authorization matches REVIEW_API_SECRET", async () => {
    process.env.REVIEW_API_SECRET = "review-secret";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.V0_API_KEY = "v0-key";

    const response = await GET(makeRequest({ authorization: "Bearer review-secret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.healthy).toBe(true);
    expect(body.dependencies.database.healthy).toBe(true);
    expect(body.dependencies.openai.healthy).toBe(true);
    expect(body.dependencies.v0.healthy).toBe(true);
  });

  it("returns 200 with full detail when Authorization matches CRON_SECRET", async () => {
    process.env.CRON_SECRET = "cron-secret";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.V0_API_KEY = "v0-key";

    const response = await GET(makeRequest({ authorization: "Bearer cron-secret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.healthy).toBe(true);
  });

  it("returns 503 with unhealthy dependencies when OpenAI key missing", async () => {
    process.env.CRON_SECRET = "cron-secret";
    // OPENAI_API_KEY intentionally missing
    process.env.V0_API_KEY = "v0-key";

    const response = await GET(makeRequest({ authorization: "Bearer cron-secret" }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.healthy).toBe(false);
    expect(body.dependencies.openai.healthy).toBe(false);
    expect(body.dependencies.openai.error_code).toBe("MISSING_ENV");
  });

  it("returns 503 when database query fails (with valid auth)", async () => {
    process.env.CRON_SECRET = "cron-secret";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.V0_API_KEY = "v0-key";
    mockDbQuery.mockRejectedValue(new Error("DB down"));

    const response = await GET(makeRequest({ authorization: "Bearer cron-secret" }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.dependencies.database.healthy).toBe(false);
  });

  it("allows access in non-production with no secrets configured (dev/CI convenience)", async () => {
    // NODE_ENV = "test" (set in beforeEach) and no REVIEW_API_SECRET / CRON_SECRET
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.V0_API_KEY = "v0-key";

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.healthy).toBe(true);
  });
});
