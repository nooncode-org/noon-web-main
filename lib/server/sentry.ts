/**
 * lib/server/sentry.ts
 *
 * B42 — Sentry skeleton.
 *
 * Wire-up plan:
 *   1. instrumentation.ts calls `initSentryIfConfigured()` at boot.
 *   2. If `SENTRY_DSN` is unset/blank, this module is a complete no-op:
 *      no Sentry SDK init runs, no log hook is registered, no client
 *      payloads are dispatched. The dep stays in node_modules but the
 *      bundle cost is negligible because the import is dynamic.
 *   3. If `SENTRY_DSN` is set, the SDK is initialised with the project's
 *      sampling configuration and `setLogHook()` is used to fan out our
 *      `log.error` / `log.warn` calls to Sentry. The logger already
 *      redacts PII before the hook fires, so what reaches Sentry is the
 *      same shape ops sees in Vercel logs — no second-layer scrubber
 *      needed.
 *
 * Why DSN-guard everything: ops controls when Sentry comes online. The
 * code lands now so when the DSN ships we only flip an env var.
 *
 * Why a dynamic import: keeps the build (and the bundled cold-start) free
 * of `@sentry/nextjs` unless DSN is set. Vercel cold-starts are sensitive
 * to top-level dep weight.
 *
 * Out of scope for the skeleton (deliberate):
 *   - `withSentryConfig` next.config wrap (build-time source-map upload +
 *     React instrumentation). Adds build complexity and an auth token;
 *     enable once ops provisions the Sentry project + auth token.
 *   - Edge runtime init — none of our edge routes throw enough to justify
 *     the overhead; revisit when we add middleware logic.
 *   - Client-side browser SDK — Phase 1 is internal-only (ADR-008), so
 *     server-side coverage is what matters now.
 */

import { setLogHook, type LogEntry } from "./logger";

type SentryModule = {
  init: (opts: {
    dsn: string;
    tracesSampleRate: number;
    environment?: string;
    release?: string;
    /** Hard-disable PII auto-detection; we redact in the logger before the hook fires. */
    sendDefaultPii: false;
  }) => void;
  captureException: (error: unknown, hint?: { extra?: Record<string, unknown> }) => void;
  captureMessage: (
    message: string,
    hint?: { level?: "info" | "warning" | "error"; extra?: Record<string, unknown> },
  ) => void;
};

let initialised = false;
let sentryRef: SentryModule | null = null;

function parseSampleRate(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) return fallback;
  return n;
}

/**
 * Adapter that forwards a `LogEntry` from `lib/server/logger.ts` to Sentry.
 *
 * Forwarding policy:
 *   - `level: "error"` with a raw error → `captureException(rawError)` so
 *     Sentry gets the real stack. The redacted entry.meta rides along as
 *     `extra` context.
 *   - `level: "error"` without a raw error → `captureMessage(entry.message,
 *     { level: "error" })`. Happens when callers do `log.error(scope, "msg")`
 *     with a string instead of an Error.
 *   - `level: "warn"` → `captureMessage(..., { level: "warning" })`.
 *   - `level: "info"` / `"debug"` → dropped. Sentry is for things that
 *     warrant a human eyeball; informational logs stay in Vercel only.
 *
 * Exported for testing; production callers go through `initSentryIfConfigured`.
 */
export function forwardLogToSentry(
  sentry: SentryModule,
  entry: LogEntry,
  rawError?: unknown,
): void {
  const extra = {
    scope: entry.scope,
    timestamp: entry.timestamp,
    ...(entry.meta ?? {}),
  };

  if (entry.level === "error") {
    if (rawError !== undefined) {
      sentry.captureException(rawError, { extra });
    } else {
      sentry.captureMessage(entry.message, { level: "error", extra });
    }
    return;
  }

  if (entry.level === "warn") {
    sentry.captureMessage(entry.message, { level: "warning", extra });
    return;
  }

  // info / debug: intentionally dropped.
}

/**
 * Boot-time entry point. Safe to call multiple times — the second call is a
 * no-op (so HMR doesn't double-register hooks in dev).
 *
 * Returns:
 *   - `"initialised"` when DSN was present and Sentry came online.
 *   - `"skipped"` when DSN was unset (the common state today).
 *   - `"already"` on subsequent calls within the same process.
 */
export async function initSentryIfConfigured(): Promise<"initialised" | "skipped" | "already"> {
  if (initialised) return "already";

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return "skipped";

  // Dynamic import keeps the SDK out of the build unless DSN is set.
  // The package is in deps so the import resolves; the cost is paid only
  // when ops actually turns Sentry on.
  const Sentry = (await import("@sentry/nextjs")) as unknown as SentryModule;
  sentryRef = Sentry;

  Sentry.init({
    dsn,
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
  });

  setLogHook((entry, rawError) => {
    // Wrap the forward in a try/catch so Sentry being temporarily down does
    // not break the calling request (the logger swallows hook errors anyway,
    // but be defensive).
    try {
      if (sentryRef) forwardLogToSentry(sentryRef, entry, rawError);
    } catch {
      // Intentional swallow — never let observability infrastructure crash a
      // production request.
    }
  });

  initialised = true;
  return "initialised";
}

/**
 * Test-only reset. Clears the module-private init state and the log hook so
 * each test starts from a clean slate. Mirrors __resetRateLimitForTests.
 */
export function __resetSentryForTests(): void {
  initialised = false;
  sentryRef = null;
  setLogHook(null);
}
