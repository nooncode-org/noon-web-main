/**
 * instrumentation.ts
 *
 * Next.js boot hook. `register()` runs once per server process / per Vercel
 * function instance at startup. Used here to fail-fast on missing critical
 * runtime service credentials.
 *
 * Future extension (B42): wire `@sentry/nextjs` initialization here in the
 * same `nodejs` branch.
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
  }
}
