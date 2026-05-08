/**
 * lib/auth/env.ts
 *
 * Pure (no NextAuth import) validation of authentication-related env vars.
 * Used by `auth.ts` at module load to fail-fast in production runtime when
 * Google OAuth credentials are missing.
 */

export type AuthEnvCheck = {
  ok: boolean;
  missing: string[];
  mode: "production-runtime" | "build" | "non-production";
};

export function checkAuthEnv(env: NodeJS.ProcessEnv = process.env): AuthEnvCheck {
  const missing: string[] = [];
  if (!env.AUTH_GOOGLE_ID?.trim()) missing.push("AUTH_GOOGLE_ID");
  if (!env.AUTH_GOOGLE_SECRET?.trim()) missing.push("AUTH_GOOGLE_SECRET");

  // `next build` runs with NODE_ENV=production but sets NEXT_PHASE.
  // Skip fail-fast during build so CI / image builds without real secrets succeed.
  const isBuildPhase = env.NEXT_PHASE === "phase-production-build";
  const isProductionRuntime = env.NODE_ENV === "production" && !isBuildPhase;

  const mode: AuthEnvCheck["mode"] = isBuildPhase
    ? "build"
    : isProductionRuntime
      ? "production-runtime"
      : "non-production";

  return { ok: missing.length === 0, missing, mode };
}
