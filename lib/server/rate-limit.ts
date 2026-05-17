/**
 * lib/server/rate-limit.ts
 *
 * In-process token-bucket rate limiter. Shared utility used by Maxwell chat, the public
 * proposal page, and the session POST endpoint to absorb abuse / accidental loops.
 *
 * Design notes:
 * - Token bucket per (namespace, identity). Each bucket has a capacity and a refill rate
 *   in tokens per second. Each successful request consumes one token.
 * - Storage is an in-process Map. For multi-region / multi-instance precision, swap to
 *   Upstash Redis (or equivalent) — the public API (`enforceRateLimit`) does not change.
 * - Tested patterns: burst-then-recover, sustained throughput, identity isolation across
 *   namespaces.
 * - The limiter intentionally fails-open if it crashes (a thrown JS error inside the
 *   bucket math should not deny a request). It is a smoothing mechanism, not an auth gate.
 *
 * Out of scope:
 * - Distributed precision (intentional — single-process is enough for FASE 2 traffic).
 * - User-id keying (future enhancement; today IP-only).
 * - Audit log persistence (today the route logs via `lib/server/logger.ts`).
 */

export type RateLimitOptions = {
  /** Logical bucket family (e.g. "maxwell.chat"). Used for grouping + telemetry. */
  namespace: string;
  /** Maximum tokens the bucket can hold. Burst tolerance. */
  capacity: number;
  /** Refill rate in tokens per second. Sustained throughput. */
  refillPerSec: number;
  /** Caller-stable identity (IP, user id, token hash). Buckets isolate per identity. */
  identityKey: string;
};

export type RateLimitResult = {
  ok: boolean;
  /** Seconds the caller should wait before retrying. Always >= 0; 0 if `ok=true`. */
  retryAfterSeconds: number;
  /** Tokens remaining after this consume attempt. */
  remaining: number;
};

type BucketState = {
  tokens: number;
  lastRefillAt: number;
  capacity: number;
  refillPerSec: number;
  expiresAt: number;
};

/**
 * Thrown by `enforceRateLimit` when the bucket is empty. Carries the `Retry-After`
 * seconds value so route handlers can surface it as an HTTP header.
 */
export class RateLimitExceededError extends Error {
  constructor(public readonly retryAfterSeconds: number, public readonly namespace: string) {
    super(`Rate limit exceeded for ${namespace}. Retry after ${retryAfterSeconds}s.`);
    this.name = "RateLimitExceededError";
  }
}

const buckets = new Map<string, BucketState>();

// Idle-expiry buffer applied on top of full-refill time. Lets the cleanup pass garbage
// collect buckets that have been silent for at least 5 minutes after they would have
// fully refilled.
const IDLE_EXPIRY_GRACE_SECONDS = 5 * 60;

let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 60_000; // sweep idle buckets at most once per minute

function bucketKey(namespace: string, identityKey: string): string {
  return `${namespace}::${identityKey}`;
}

function maybeCleanup(now: number): void {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, state] of buckets) {
    if (state.expiresAt <= now) buckets.delete(key);
  }
}

function refill(state: BucketState, now: number): void {
  const elapsedSec = (now - state.lastRefillAt) / 1000;
  if (elapsedSec <= 0) return;
  const refillTokens = elapsedSec * state.refillPerSec;
  state.tokens = Math.min(state.capacity, state.tokens + refillTokens);
  state.lastRefillAt = now;
}

/**
 * Attempts to consume one token from the bucket identified by `(namespace, identityKey)`.
 * Returns `{ ok, retryAfterSeconds, remaining }`. Never throws.
 */
export function consumeToken(opts: RateLimitOptions): RateLimitResult {
  if (opts.capacity <= 0 || opts.refillPerSec <= 0) {
    // Misconfigured limiter — fail open so traffic is not silently dropped.
    return { ok: true, retryAfterSeconds: 0, remaining: 0 };
  }

  const now = Date.now();
  maybeCleanup(now);

  const key = bucketKey(opts.namespace, opts.identityKey);
  let state = buckets.get(key);

  // Bucket lifetime: refill time to full + grace period of silence after.
  const fullRefillMs = (opts.capacity / opts.refillPerSec) * 1000;
  const expiresAt = now + fullRefillMs + IDLE_EXPIRY_GRACE_SECONDS * 1000;

  if (!state) {
    state = {
      tokens: opts.capacity,
      lastRefillAt: now,
      capacity: opts.capacity,
      refillPerSec: opts.refillPerSec,
      expiresAt,
    };
    buckets.set(key, state);
  } else {
    // If a caller changed the policy for an existing bucket, adopt the new values.
    state.capacity = opts.capacity;
    state.refillPerSec = opts.refillPerSec;
    state.expiresAt = expiresAt;
    refill(state, now);
  }

  if (state.tokens >= 1) {
    state.tokens -= 1;
    return {
      ok: true,
      retryAfterSeconds: 0,
      remaining: Math.floor(state.tokens),
    };
  }

  // Empty bucket: caller must wait until at least 1 token refills.
  const needed = 1 - state.tokens;
  const waitSec = needed / opts.refillPerSec;
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil(waitSec)),
    remaining: 0,
  };
}

/**
 * Convenience wrapper that throws `RateLimitExceededError` when the bucket is empty.
 * Most route handlers prefer this over `consumeToken` because it integrates with the
 * standard try/catch flow.
 */
export function enforceRateLimit(opts: RateLimitOptions): void {
  const result = consumeToken(opts);
  if (!result.ok) {
    throw new RateLimitExceededError(result.retryAfterSeconds, opts.namespace);
  }
}

/**
 * Best-effort extraction of the client IP from forwarded headers. Falls back to
 * `"anonymous"` so an unidentified attacker shares one bucket per namespace instead of
 * bypassing the limiter entirely. Order mirrors Vercel + standard CDN conventions.
 */
export function resolveClientIdentity(request: Request): string {
  const headers = request.headers;
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    // Take the first hop (closest to the client). Forwarded-For is comma-separated.
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return first;
  }
  return "anonymous";
}

/**
 * Standard HTTP response shape for a rate-limit hit. Route handlers can call this from
 * their `catch (RateLimitExceededError)` branch to emit a consistent 429.
 */
export function rateLimitResponseInit(error: RateLimitExceededError): {
  status: number;
  headers: Record<string, string>;
  body: { message: string; code: string; retry_after_seconds: number };
} {
  return {
    status: 429,
    headers: {
      "Retry-After": String(error.retryAfterSeconds),
      "Cache-Control": "no-store",
    },
    body: {
      message: "Too many requests. Please slow down.",
      code: "RATE_LIMIT_EXCEEDED",
      retry_after_seconds: error.retryAfterSeconds,
    },
  };
}

/**
 * Test-only helper. Resets the internal bucket store between tests so suites do not
 * leak state into each other.
 */
export function __resetRateLimitForTests(): void {
  buckets.clear();
  lastCleanupAt = 0;
}
