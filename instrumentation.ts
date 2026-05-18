/**
 * instrumentation.ts
 *
 * Next.js boot hook. `register()` is invoked once per server instance, before
 * any request is handled. We use it to fail fast in production when the
 * external services we depend on (OpenAI, v0, Resend, NoonApp) are
 * misconfigured.
 *
 * No Sentry / Datadog / third-party error tracker is wired here — Pedro
 * chose Vercel Analytics + Vercel logs only for soft launch
 * (see roadmap §10.8.3). If error tracking is reconsidered later, this
 * file is also the canonical place to register the Sentry client.
 */

import { checkCriticalEnv, formatCriticalEnvDiagnostic } from "@/lib/server/critical-env";

export function register() {
  // Only the Node.js runtime can see process.env at boot. The Edge runtime
  // also calls `register()` but we don't gate the boot for Edge today —
  // there are no Edge routes that depend on these secrets.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const check = checkCriticalEnv();
  if (check.ok) return;

  const diagnostic = formatCriticalEnvDiagnostic(check);

  if (check.mode === "production-runtime") {
    throw new Error(
      `[boot] Refusing to start in production: ${diagnostic} ` +
        "Configure the missing secrets in the Vercel dashboard (or the equivalent for your deploy target) before serving traffic.",
    );
  }

  // Build phase or non-production: warn loud so the operator sees the gap
  // in logs without blocking the build.
  console.warn(`[boot] ${diagnostic} The app will start but features depending on these services will fail at first use.`);
}
