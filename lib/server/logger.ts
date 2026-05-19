/**
 * lib/server/logger.ts
 *
 * Structured server logger with PII-safe redaction.
 *
 * Replaces ad-hoc `console.error` calls scattered across routes. Output is JSON-per-line
 * so Vercel's log aggregator can parse and index each entry. PII (emails, tokens, stacks
 * in production) is redacted at the boundary so downstream consumers (Vercel logs, future
 * Sentry hook) never see raw sensitive values.
 *
 * Design notes:
 * - `scope` is a required first argument so every log entry is grep-able and groupable
 *   (e.g. "maxwell.chat", "stripe.webhook", "upgrade.analyze").
 * - `meta` is an arbitrary object; values are recursively redacted with the same rules.
 * - `log.error(scope, err, meta?)` accepts an `unknown` error and normalises it to a
 *   `{ message, stack? }` shape before emitting.
 * - `setLogHook` exposes a fan-out point for Bloque 7 (Sentry) to register a sink without
 *   touching every caller.
 *
 * Out of scope (deliberate):
 * - Request correlation IDs — added by the route handler if needed.
 * - Async log shipping — Vercel handles ingestion via stdout already.
 * - Log rotation — Vercel handles.
 */

import { createHash } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMeta = Record<string, unknown>;

export type LogEntry = {
  level: LogLevel;
  scope: string;
  message: string;
  timestamp: string;
  meta?: LogMeta;
};

export type LogHook = (entry: LogEntry, rawError?: unknown) => void;

let registeredHook: LogHook | null = null;

/**
 * Registers a downstream sink (e.g. Sentry) called after every log entry. Pass `null` to
 * clear. Errors thrown by the hook are swallowed so log failures never crash a request.
 */
export function setLogHook(hook: LogHook | null): void {
  registeredHook = hook;
}

/**
 * Matches meta-object keys whose value should be redacted regardless of content.
 *
 * Deliberately NOT matching `session` or `auth` alone — those generate too many false
 * positives (`sessionId`, `authMode`, `authorEmail` etc. are commonly safe ids/labels).
 * Real sensitive cases like `session_token`, `auth_secret`, `Authorization` header still
 * match via `token`, `secret`, `authorization` respectively.
 */
const SENSITIVE_KEY_PATTERN =
  /password|secret|token|api_?key|authorization|cookie|bearer|jwt|signature|credential/i;

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._\-+/=]{8,}/gi;

const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g;

/**
 * One-way fingerprint of an email so log entries can correlate without exposing the
 * address. 8 hex chars = 32 bits of entropy — enough to group, not enough to brute-force
 * the original.
 */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 8);
}

function redactString(value: string): string {
  return value
    .replace(EMAIL_PATTERN, (match) => `[email:${hashEmail(match)}]`)
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(JWT_PATTERN, "[jwt:redacted]");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth-limit]";

  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (value === undefined) return undefined;

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redactValue(v, depth + 1);
      }
    }
    return out;
  }

  // Non-plain objects (Date, Buffer, etc.) — stringify safely.
  try {
    return redactString(String(value));
  } catch {
    return "[unserializable]";
  }
}

function normaliseError(err: unknown): { message: string; stack?: string; name?: string } {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    };
  }
  if (typeof err === "string") return { message: err };
  if (err && typeof err === "object") {
    const maybeMessage =
      "message" in err && typeof (err as { message?: unknown }).message === "string"
        ? (err as { message: string }).message
        : "Unknown error.";
    return { message: maybeMessage };
  }
  return { message: "Unknown error." };
}

function emit(level: LogLevel, scope: string, message: string, meta?: LogMeta, rawError?: unknown): void {
  const entry: LogEntry = {
    level,
    scope,
    message: redactString(message),
    timestamp: new Date().toISOString(),
  };

  if (meta && Object.keys(meta).length > 0) {
    const redacted = redactValue(meta) as LogMeta;
    if (Object.keys(redacted).length > 0) {
      entry.meta = redacted;
    }
  }

  // Output as a single JSON line — Vercel logs parse each line independently.
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (level === "debug" && process.env.NODE_ENV === "production") {
    // Debug logs are silenced in production by default.
    // Set NOON_LOG_DEBUG=1 to override.
    if (process.env.NOON_LOG_DEBUG !== "1") return;
    console.log(line);
  } else {
    console.log(line);
  }

  if (registeredHook) {
    try {
      registeredHook(entry, rawError);
    } catch {
      // Never let a hook failure surface to the caller.
    }
  }
}

export const log = {
  debug(scope: string, message: string, meta?: LogMeta): void {
    emit("debug", scope, message, meta);
  },
  info(scope: string, message: string, meta?: LogMeta): void {
    emit("info", scope, message, meta);
  },
  warn(scope: string, message: string, meta?: LogMeta): void {
    emit("warn", scope, message, meta);
  },
  /**
   * Log an error. Accepts an `unknown` error (typed for `catch (error)` use) plus
   * optional structured meta. The error's `message`, `name`, and (in non-prod) `stack`
   * are folded into `meta.error`.
   */
  error(scope: string, err: unknown, meta?: LogMeta): void {
    const errorShape = normaliseError(err);
    const mergedMeta: LogMeta = { ...meta, error: errorShape };
    emit("error", scope, errorShape.message, mergedMeta, err);
  },
};

/**
 * Test-only helper exported for unit coverage. Resets the registered hook between tests.
 */
export function __resetLogHookForTests(): void {
  registeredHook = null;
}
