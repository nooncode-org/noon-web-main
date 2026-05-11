/**
 * lib/server/critical-env.ts
 *
 * Pure (no side effects, no Next imports) validation of the external-service
 * env vars that this app depends on at runtime.
 *
 * Used at server boot from `instrumentation.ts` to fail fast in production
 * when a service is misconfigured, instead of degrading silently and only
 * surfacing the issue when the first real customer hits the broken path.
 *
 * Same shape as `lib/auth/env.ts` — checks against `NEXT_PHASE` so a
 * `next build` run without the secrets configured still completes.
 */

export type CriticalService =
  | "openai"
  | "v0"
  | "resend"
  | "noon_app";

export type CriticalEnvCheck = {
  ok: boolean;
  /** services with at least one missing env var */
  unconfigured: CriticalService[];
  /** flat list of missing env var names, for the error message */
  missing: string[];
  mode: "production-runtime" | "build" | "non-production";
};

export type CriticalServiceSpec = {
  service: CriticalService;
  vars: readonly string[];
};

// The canonical list of service → required env vars. Kept here so the same
// list is consulted by the runtime check and by tests.
export const CRITICAL_SERVICES: readonly CriticalServiceSpec[] = [
  { service: "openai", vars: ["OPENAI_API_KEY"] },
  { service: "v0", vars: ["V0_API_KEY"] },
  { service: "resend", vars: ["RESEND_API_KEY", "MAIL_FROM"] },
  { service: "noon_app", vars: ["NOON_APP_WEBHOOK_SECRET", "NOON_APP_BASE_URL"] },
];

// We accept the permissive `Record<string, string | undefined>` shape so
// tests can pass partial env objects without needing to satisfy
// `NodeJS.ProcessEnv`'s strict `NODE_ENV` requirement. `process.env` is
// assignable to this shape.
export type EnvRecord = Record<string, string | undefined>;

export function checkCriticalEnv(env: EnvRecord = process.env): CriticalEnvCheck {
  const missing: string[] = [];
  const unconfigured: CriticalService[] = [];

  for (const { service, vars } of CRITICAL_SERVICES) {
    const missingForService = vars.filter((name) => !env[name]?.trim());
    if (missingForService.length > 0) {
      missing.push(...missingForService);
      unconfigured.push(service);
    }
  }

  // `next build` runs with NODE_ENV=production and sets NEXT_PHASE. Skip the
  // throw during build so CI / image builds without real secrets succeed.
  const isBuildPhase = env.NEXT_PHASE === "phase-production-build";
  const isProductionRuntime = env.NODE_ENV === "production" && !isBuildPhase;

  const mode: CriticalEnvCheck["mode"] = isBuildPhase
    ? "build"
    : isProductionRuntime
      ? "production-runtime"
      : "non-production";

  return { ok: missing.length === 0, unconfigured, missing, mode };
}

/**
 * Format a human-readable diagnostic line for the boot log.
 * Surfaces which services are unconfigured and which env vars are missing
 * for each, so the operator sees the fix in a single line.
 */
export function formatCriticalEnvDiagnostic(check: CriticalEnvCheck): string {
  if (check.ok) return "All critical services configured.";
  const byService = CRITICAL_SERVICES.filter((s) =>
    check.unconfigured.includes(s.service),
  )
    .map((s) => {
      const present = s.vars.filter((v) => !check.missing.includes(v));
      const missing = s.vars.filter((v) => check.missing.includes(v));
      return `${s.service} (missing ${missing.join(", ")}${present.length ? `; present ${present.join(", ")}` : ""})`;
    })
    .join("; ");
  return `Critical service env vars missing: ${byService}.`;
}
