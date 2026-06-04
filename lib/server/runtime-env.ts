/**
 * lib/server/runtime-env.ts
 *
 * Pure validation of runtime service credentials (OpenAI, V0, Resend, NoonApp).
 * Used by `instrumentation.ts` to fail-fast at boot in production when critical
 * service env vars are missing. Mirrors the `lib/auth/env.ts` pattern.
 *
 * Service criticality:
 * - OpenAI: critical (Maxwell chat depends on it).
 * - V0:     critical (prototype generation depends on it).
 * - Resend: critical (proposal email delivery). All 3 vars must travel together.
 * - Stripe: critical (card checkout is the primary launch payment path — the
 *           public proposal renders "Pay with card" as the primary CTA). Both
 *           vars travel together: STRIPE_SECRET_KEY powers checkout-session
 *           creation, STRIPE_WEBHOOK_SECRET powers the confirmation webhook.
 *           Missing the secret key 503s the primary CTA; missing the webhook
 *           secret takes payment that can never be confirmed (proposal stuck in
 *           payment_pending) — so boot must fail rather than ship either half.
 *           The manual `submit_payment_evidence` path remains as a fallback but
 *           is no longer the only payment route, so it does not soften this gate.
 * - NoonApp: optional. Per .env.example lines 40-42, when either var is empty the
 *            outbound webhook is skipped and the proposal draft is still stored
 *            locally — degraded but not broken. Surfaced as warning, not failure.
 *            The webhook secret is the canonical NOON_WEBSITE_WEBHOOK_SECRET
 *            (cross-repo contract v1). The legacy NOON_APP_WEBHOOK_SECRET
 *            fallback was removed on 2026-05-25 after both repos finished the
 *            rename window. The legacy-accepting helper below is preserved as
 *            a commented block in case a future cross-repo rename needs the
 *            same pattern.
 */

export type ServiceLevel = "critical" | "optional";

export type ServiceCheck = {
  service: string;
  level: ServiceLevel;
  required: string[];
  missing: string[];
  ok: boolean;
};

export type RuntimeEnvMode = "production-runtime" | "build" | "non-production";

export type RuntimeEnvReport = {
  mode: RuntimeEnvMode;
  checks: ServiceCheck[];
  criticalMissing: ServiceCheck[];
  optionalMissing: ServiceCheck[];
  ok: boolean;
};

function checkVars(env: NodeJS.ProcessEnv, required: string[]): string[] {
  return required.filter((v) => !env[v]?.trim());
}

function buildCheck(
  service: string,
  level: ServiceLevel,
  required: string[],
  env: NodeJS.ProcessEnv,
): ServiceCheck {
  const missing = checkVars(env, required);
  return { service, level, required, missing, ok: missing.length === 0 };
}

// SAFETY-NET PRESERVED — removed 2026-05-25 after both repos completed the
// `NOON_APP_WEBHOOK_SECRET` → `NOON_WEBSITE_WEBHOOK_SECRET` rename. The helper
// below is kept as a commented block: a future cross-repo env rename can copy
// it back verbatim and reuse the multi-alternative shape.
//
// /**
//  * Same shape as `buildCheck` but the secret slot accepts any of several
//  * alternative env var names — at least one must be set.
//  *
//  * Used during a cross-repo secret rename window where Web accepts both the
//  * canonical name and the legacy name. The FIRST alternative is treated as
//  * canonical for messaging: when none are set, the `missing` array reports
//  * the canonical name (so logs guide operators toward the new name).
//  */
// function buildCheckWithSecretAlternatives(
//   service: string,
//   level: ServiceLevel,
//   baseRequired: string[],
//   secretAlternatives: [string, ...string[]],
//   env: NodeJS.ProcessEnv,
// ): ServiceCheck {
//   const baseMissing = checkVars(env, baseRequired);
//   const anySecretSet = secretAlternatives.some((name) => env[name]?.trim());
//   const canonical = secretAlternatives[0];
//   const required = [...baseRequired, canonical];
//   const missing = anySecretSet ? baseMissing : [...baseMissing, canonical];
//   return { service, level, required, missing, ok: missing.length === 0 };
// }

export function checkRuntimeEnv(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeEnvReport {
  // `next build` runs with NODE_ENV=production but sets NEXT_PHASE.
  // Skip the assertion path during build so CI / image builds without real
  // secrets succeed. Same convention as lib/auth/env.ts.
  const isBuildPhase = env.NEXT_PHASE === "phase-production-build";
  const isProductionRuntime = env.NODE_ENV === "production" && !isBuildPhase;
  const mode: RuntimeEnvMode = isBuildPhase
    ? "build"
    : isProductionRuntime
      ? "production-runtime"
      : "non-production";

  const checks: ServiceCheck[] = [
    buildCheck("OpenAI", "critical", ["OPENAI_API_KEY"], env),
    buildCheck("V0", "critical", ["V0_API_KEY"], env),
    buildCheck(
      "Resend",
      "critical",
      ["RESEND_API_KEY", "MAIL_FROM", "MAIL_PROVIDER"],
      env,
    ),
    buildCheck(
      "Stripe",
      "critical",
      ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
      env,
    ),
    buildCheck(
      "NoonApp",
      "optional",
      ["NOON_APP_BASE_URL", "NOON_WEBSITE_WEBHOOK_SECRET"],
      env,
    ),
  ];

  const criticalMissing = checks.filter((c) => c.level === "critical" && !c.ok);
  const optionalMissing = checks.filter((c) => c.level === "optional" && !c.ok);
  return {
    mode,
    checks,
    criticalMissing,
    optionalMissing,
    ok: criticalMissing.length === 0,
  };
}

/**
 * Throws when running in production runtime mode and at least one critical
 * service has missing env vars. No-op in build phase and outside production.
 */
export function assertRuntimeEnvForProduction(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const report = checkRuntimeEnv(env);
  if (report.mode !== "production-runtime") return;
  if (report.ok) return;

  const summary = report.criticalMissing
    .map((c) => `${c.service} (missing: ${c.missing.join(", ")})`)
    .join("; ");
  throw new Error(`Runtime env check failed for production: ${summary}`);
}

/**
 * Human-readable single-string summary of a report, safe to log at boot.
 * Each line shows one service with its level and either "configured" or the
 * missing variables.
 */
export function formatRuntimeEnvReport(report: RuntimeEnvReport): string {
  const lines = [`[runtime-env] mode=${report.mode}`];
  for (const c of report.checks) {
    const icon = c.ok ? "ok" : c.level === "critical" ? "FAIL" : "warn";
    const detail = c.ok ? "configured" : `missing ${c.missing.join(", ")}`;
    lines.push(`  [${icon}] ${c.service} (${c.level}) — ${detail}`);
  }
  return lines.join("\n");
}
