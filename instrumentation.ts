/**
 * instrumentation.ts
 *
 * Next.js boot hook. `register()` runs once per server process / per Vercel
 * function instance at startup. Used here to:
 *   1. Fail-fast on missing critical runtime service credentials (B43).
 *   2. Initialise Sentry when SENTRY_DSN is configured (B42).
 *
 * Reference: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkRuntimeEnv, formatRuntimeEnvReport, assertRuntimeEnvForProduction } =
      await import("./lib/server/runtime-env");

    // Always log the report — visible in Vercel function logs at cold-start
    // and useful for diagnosing config drift in non-production environments.
    const report = checkRuntimeEnv();
    console.log(formatRuntimeEnvReport(report));

    // Throw in production-runtime when critical vars are missing. Vercel will
    // mark the deployment unhealthy and surface the error in logs.
    assertRuntimeEnvForProduction();

    // B42 — Sentry. No-op when SENTRY_DSN is unset (the common state today).
    // When ops sets the DSN, this initialises @sentry/nextjs and registers a
    // log hook so log.error / log.warn from lib/server/logger.ts get
    // forwarded to Sentry. We dynamically import the Sentry module inside
    // initSentryIfConfigured so the SDK weight is paid only when active.
    const { initSentryIfConfigured } = await import("./lib/server/sentry");
    const sentryStatus = await initSentryIfConfigured();
    // One-line breadcrumb so cold-start logs make the runtime state obvious.
    console.log(`[instrumentation] sentry=${sentryStatus}`);
  }
}
