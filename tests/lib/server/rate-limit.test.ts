/**
 * tests/lib/server/rate-limit.test.ts
 *
 * Coverage for the in-process token-bucket rate limiter.
 *
 * Test policy is intentionally tight on time math so a regression in `refill()` or
 * bucket-key isolation gets caught at vitest level. Uses `vi.useFakeTimers()` to make
 * refill behavior deterministic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetRateLimitForTests,
  consumeToken,
  enforceRateLimit,
  RateLimitExceededError,
  rateLimitResponseInit,
  resolveClientIdentity,
} from "@/lib/server/rate-limit";

describe("consumeToken", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T00:00:00Z"));
    __resetRateLimitForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetRateLimitForTests();
  });

  it("returns ok=true on first call (bucket starts full)", () => {
    const result = consumeToken({
      namespace: "test",
      capacity: 5,
      refillPerSec: 1,
      identityKey: "user-1",
    });
    expect(result.ok).toBe(true);
    expect(result.retryAfterSeconds).toBe(0);
    expect(result.remaining).toBe(4);
  });

  it("consumes exactly one token per call until capacity is reached", () => {
    const opts = { namespace: "test", capacity: 3, refillPerSec: 0.1, identityKey: "user-1" };
    expect(consumeToken(opts).remaining).toBe(2);
    expect(consumeToken(opts).remaining).toBe(1);
    expect(consumeToken(opts).remaining).toBe(0);

    const denied = consumeToken(opts);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("refills tokens based on elapsed time", () => {
    const opts = { namespace: "test", capacity: 5, refillPerSec: 1, identityKey: "user-1" };
    // Drain the bucket.
    for (let i = 0; i < 5; i++) consumeToken(opts);

    // Immediately blocked.
    expect(consumeToken(opts).ok).toBe(false);

    // Advance 2 seconds → 2 tokens refilled.
    vi.advanceTimersByTime(2_000);
    expect(consumeToken(opts).ok).toBe(true);
    expect(consumeToken(opts).ok).toBe(true);
    expect(consumeToken(opts).ok).toBe(false);
  });

  it("caps refill at capacity (no token overflow)", () => {
    const opts = { namespace: "test", capacity: 3, refillPerSec: 1, identityKey: "user-1" };
    consumeToken(opts); // remaining=2
    vi.advanceTimersByTime(60_000); // 60s elapsed → would refill 60 tokens, but capacity is 3

    // Should be able to consume 3 (full capacity), no more.
    expect(consumeToken(opts).ok).toBe(true);
    expect(consumeToken(opts).ok).toBe(true);
    expect(consumeToken(opts).ok).toBe(true);
    expect(consumeToken(opts).ok).toBe(false);
  });

  it("isolates buckets across (namespace, identity) pairs", () => {
    const ns1 = { namespace: "alpha", capacity: 2, refillPerSec: 0.1, identityKey: "user-1" };
    const ns2 = { namespace: "beta", capacity: 2, refillPerSec: 0.1, identityKey: "user-1" };
    const user2 = { namespace: "alpha", capacity: 2, refillPerSec: 0.1, identityKey: "user-2" };

    // Drain user-1 / alpha.
    consumeToken(ns1);
    consumeToken(ns1);
    expect(consumeToken(ns1).ok).toBe(false);

    // user-1 / beta still has tokens (different namespace).
    expect(consumeToken(ns2).ok).toBe(true);

    // user-2 / alpha still has tokens (different identity).
    expect(consumeToken(user2).ok).toBe(true);
  });

  it("returns ok=true (fail-open) on misconfigured capacity=0", () => {
    expect(
      consumeToken({ namespace: "test", capacity: 0, refillPerSec: 1, identityKey: "k" }).ok,
    ).toBe(true);
  });

  it("returns ok=true (fail-open) on misconfigured refillPerSec=0", () => {
    expect(
      consumeToken({ namespace: "test", capacity: 5, refillPerSec: 0, identityKey: "k" }).ok,
    ).toBe(true);
  });

  it("reports retryAfterSeconds rounded up to at least 1 second", () => {
    const opts = { namespace: "test", capacity: 1, refillPerSec: 0.5, identityKey: "k" };
    consumeToken(opts);
    const denied = consumeToken(opts);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});

describe("enforceRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T00:00:00Z"));
    __resetRateLimitForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetRateLimitForTests();
  });

  it("does not throw when within capacity", () => {
    expect(() =>
      enforceRateLimit({ namespace: "test", capacity: 3, refillPerSec: 1, identityKey: "k" }),
    ).not.toThrow();
  });

  it("throws RateLimitExceededError when bucket is empty", () => {
    const opts = { namespace: "test", capacity: 1, refillPerSec: 0.1, identityKey: "k" };
    enforceRateLimit(opts);
    expect(() => enforceRateLimit(opts)).toThrowError(RateLimitExceededError);
  });

  it("the thrown error carries namespace and retryAfterSeconds", () => {
    const opts = { namespace: "maxwell.chat", capacity: 1, refillPerSec: 0.1, identityKey: "k" };
    enforceRateLimit(opts);
    try {
      enforceRateLimit(opts);
      throw new Error("Expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitExceededError);
      const err = e as RateLimitExceededError;
      expect(err.namespace).toBe("maxwell.chat");
      expect(err.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("resolveClientIdentity", () => {
  function req(headers: Record<string, string>): Request {
    return new Request("http://localhost/", { headers });
  }

  // E2-SEC (MED-1, auditoría 2026-07): orden plataforma-primero. Un
  // x-forwarded-for suministrado por el cliente NUNCA debe ganarle a los
  // headers que fija el edge de Vercel — rotarlo bypasearía el anti-scanner.
  it("prefers platform-set x-real-ip over a client-supplied x-forwarded-for", () => {
    expect(
      resolveClientIdentity(
        req({ "x-forwarded-for": "6.6.6.6, 10.0.0.1", "x-real-ip": "198.51.100.7" }),
      ),
    ).toBe("198.51.100.7");
  });

  it("prefers x-vercel-forwarded-for over x-forwarded-for when x-real-ip is missing", () => {
    expect(
      resolveClientIdentity(
        req({ "x-forwarded-for": "6.6.6.6", "x-vercel-forwarded-for": "192.0.2.1" }),
      ),
    ).toBe("192.0.2.1");
  });

  it("uses first hop of x-forwarded-for only as a last resort", () => {
    expect(resolveClientIdentity(req({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe(
      "203.0.113.5",
    );
  });

  it("returns 'anonymous' when no forwarded headers are present", () => {
    expect(resolveClientIdentity(req({}))).toBe("anonymous");
  });

  it("ignores empty / whitespace-only header values", () => {
    expect(resolveClientIdentity(req({ "x-real-ip": "   " }))).toBe("anonymous");
  });
});

describe("rateLimitResponseInit", () => {
  it("builds a 429 response shape with Retry-After header and machine-readable code", () => {
    const err = new RateLimitExceededError(7, "maxwell.chat");
    const init = rateLimitResponseInit(err);

    expect(init.status).toBe(429);
    expect(init.headers["Retry-After"]).toBe("7");
    expect(init.headers["Cache-Control"]).toBe("no-store");
    expect(init.body.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(init.body.retry_after_seconds).toBe(7);
  });
});
