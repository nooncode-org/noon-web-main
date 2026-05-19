/**
 * tests/maxwell/session.test.ts
 *
 * Coverage for `GET|POST /api/maxwell/session` — the legacy "capture the
 * initial prompt" surface that backs the public landing-page intake.
 * Distinct from `tests/maxwell/studio-*` which test the post-payment
 * studio session APIs.
 *
 * Mocked: noon-storage (the postgres-backed session repo), rate-limit
 * (the in-process bucket limiter). Schema + route handler logic run
 * real so any zod / cookie / header drift surfaces here.
 *
 * Coverage matrix:
 *   - GET without cookie → returns { session: null }
 *   - GET with cookie that matches DB → returns the record
 *   - GET with cookie that has no DB row → returns { session: null }
 *   - POST happy path no cookie → creates session, sets cookie, returns record
 *   - POST happy path with existing cookie → upserts, returns updated record
 *   - POST with prompt too short (< 10 chars) → 400 ZodError with fieldErrors
 *   - POST with missing prompt → 400 ZodError
 *   - POST with prompt too long (> 4000 chars) → 400 ZodError
 *   - POST rate-limited → 429 with Retry-After header
 *   - POST when upsert throws → 500 with generic message
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE the route import so vi hoists them.
// ---------------------------------------------------------------------------

vi.mock("@/lib/server/noon-storage", () => ({
  getMaxwellSession: vi.fn(),
  upsertMaxwellSession: vi.fn(),
}));

vi.mock("@/lib/server/rate-limit", async () => {
  class RateLimitExceededError extends Error {
    constructor(
      public readonly retryAfterSeconds: number,
      public readonly namespace: string,
    ) {
      super(`Rate limit exceeded for ${namespace}.`);
      this.name = "RateLimitExceededError";
    }
  }

  return {
    enforceRateLimit: vi.fn(),
    resolveClientIdentity: vi.fn(() => "test-ip"),
    RateLimitExceededError,
    rateLimitResponseInit: (error: RateLimitExceededError) => ({
      status: 429,
      headers: {
        "Retry-After": String(error.retryAfterSeconds),
        "Cache-Control": "no-store",
      },
      body: {
        message: "Too many requests. Slow down and try again shortly.",
        code: "RATE_LIMITED",
        retry_after_seconds: error.retryAfterSeconds,
      },
    }),
  };
});

import * as storage from "@/lib/server/noon-storage";
import * as rateLimit from "@/lib/server/rate-limit";
import { GET, POST } from "@/app/api/maxwell/session/route";
import { maxwellSessionCookieName } from "@/lib/maxwell";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROUTE = "http://localhost/api/maxwell/session";

function fakeRecord(overrides: Partial<storage.MaxwellSessionRecord> = {}) {
  return {
    id: "session-1",
    prompt: "Build a Maxwell prototype for an idea",
    source: "landing",
    status: "captured",
    firstPromptCapturedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } satisfies storage.MaxwellSessionRecord;
}

function getReq(cookie?: string) {
  return new Request(ROUTE, {
    method: "GET",
    headers: cookie ? { cookie } : undefined,
  });
}

function postReq(body: unknown, cookie?: string) {
  return new Request(ROUTE, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: rate limiter passes silently. Tests that need it to trip
  // override via mockImplementationOnce.
  vi.mocked(rateLimit.enforceRateLimit).mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe("GET /api/maxwell/session", () => {
  it("returns { session: null } when no cookie is present", async () => {
    vi.mocked(storage.getMaxwellSession).mockResolvedValue(null);

    const res = await GET(getReq());
    expect(res.status).toBe(200);

    const body = (await res.json()) as { session: unknown };
    expect(body.session).toBeNull();
    // The route resolves null cookie → calls getMaxwellSession(null) → null.
    expect(storage.getMaxwellSession).toHaveBeenCalledWith(null);
  });

  it("returns the record when the cookie matches an existing session", async () => {
    const record = fakeRecord();
    vi.mocked(storage.getMaxwellSession).mockResolvedValue(record);

    const res = await GET(getReq(`${maxwellSessionCookieName}=session-1`));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { session: storage.MaxwellSessionRecord };
    expect(body.session).toEqual(record);
    expect(storage.getMaxwellSession).toHaveBeenCalledWith("session-1");
  });

  it("returns { session: null } when the cookie has no DB row (stale cookie)", async () => {
    vi.mocked(storage.getMaxwellSession).mockResolvedValue(null);

    const res = await GET(getReq(`${maxwellSessionCookieName}=ghost-id`));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { session: unknown };
    expect(body.session).toBeNull();
    expect(storage.getMaxwellSession).toHaveBeenCalledWith("ghost-id");
  });

  it("sets Cache-Control: no-store so the response is not browser-cached", async () => {
    vi.mocked(storage.getMaxwellSession).mockResolvedValue(null);
    const res = await GET(getReq());
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

// ---------------------------------------------------------------------------
// POST — happy paths
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/session — happy paths", () => {
  it("creates a session when no cookie is present and returns the record + sets cookie", async () => {
    const record = fakeRecord({ id: "new-session", prompt: "Long enough prompt to pass" });
    vi.mocked(storage.upsertMaxwellSession).mockResolvedValue(record);

    const res = await POST(
      postReq({ prompt: "Long enough prompt to pass", source: "landing" }),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { session: storage.MaxwellSessionRecord };
    expect(body.session).toEqual(record);

    // upsert called with the parsed payload + null cookie.
    expect(storage.upsertMaxwellSession).toHaveBeenCalledWith({
      prompt: "Long enough prompt to pass",
      source: "landing",
      sessionId: null,
    });

    // Set-Cookie includes the session id + HttpOnly + SameSite=lax.
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${maxwellSessionCookieName}=new-session`);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  it("uses the cookie session id when present so the upsert targets the existing row", async () => {
    const record = fakeRecord({ id: "existing-session", prompt: "Updated prompt content here" });
    vi.mocked(storage.upsertMaxwellSession).mockResolvedValue(record);

    const res = await POST(
      postReq(
        { prompt: "Updated prompt content here", source: "landing" },
        `${maxwellSessionCookieName}=existing-session`,
      ),
    );
    expect(res.status).toBe(200);

    expect(storage.upsertMaxwellSession).toHaveBeenCalledWith({
      prompt: "Updated prompt content here",
      source: "landing",
      sessionId: "existing-session",
    });
  });

  it("treats missing optional 'source' as default empty string per zod schema", async () => {
    const record = fakeRecord({ source: "" });
    vi.mocked(storage.upsertMaxwellSession).mockResolvedValue(record);

    await POST(postReq({ prompt: "Long enough prompt to pass" }));

    expect(storage.upsertMaxwellSession).toHaveBeenCalledWith(
      expect.objectContaining({ source: "" }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST — Zod validation
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/session — Zod validation", () => {
  it("returns 400 with fieldErrors when the prompt is shorter than 10 chars", async () => {
    const res = await POST(postReq({ prompt: "short" }));
    expect(res.status).toBe(400);

    const body = (await res.json()) as { message: string; fieldErrors: Record<string, string[]> };
    expect(body.message).toMatch(/detail/i);
    expect(body.fieldErrors.prompt).toBeDefined();
    expect(storage.upsertMaxwellSession).not.toHaveBeenCalled();
  });

  it("returns 400 when the prompt is missing entirely", async () => {
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);

    const body = (await res.json()) as { fieldErrors: Record<string, string[]> };
    expect(body.fieldErrors.prompt).toBeDefined();
    expect(storage.upsertMaxwellSession).not.toHaveBeenCalled();
  });

  it("returns 400 when the prompt exceeds 4000 chars", async () => {
    const longPrompt = "x".repeat(4001);
    const res = await POST(postReq({ prompt: longPrompt }));
    expect(res.status).toBe(400);

    const body = (await res.json()) as { fieldErrors: Record<string, string[]> };
    expect(body.fieldErrors.prompt).toBeDefined();
    expect(storage.upsertMaxwellSession).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST — rate limiting
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/session — rate limiting", () => {
  it("returns 429 + Retry-After when the bucket is exhausted", async () => {
    vi.mocked(rateLimit.enforceRateLimit).mockImplementationOnce(() => {
      throw new rateLimit.RateLimitExceededError(42, "maxwell.session");
    });

    const res = await POST(postReq({ prompt: "Long enough prompt to pass" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");

    const body = (await res.json()) as { code: string; retry_after_seconds: number };
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.retry_after_seconds).toBe(42);

    // Storage was never touched — rate limit short-circuited before the upsert.
    expect(storage.upsertMaxwellSession).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST — storage failure
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/session — storage failure", () => {
  it("returns 500 with a generic message when the upsert throws", async () => {
    vi.mocked(storage.upsertMaxwellSession).mockRejectedValue(new Error("Postgres timeout"));

    const res = await POST(postReq({ prompt: "Long enough prompt to pass" }));
    expect(res.status).toBe(500);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/could not save/i);
    // Internal error message is NOT leaked to the client.
    expect(body.message).not.toContain("Postgres");
  });
});
