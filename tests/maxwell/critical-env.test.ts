import { describe, expect, it } from "vitest";
import {
  CRITICAL_SERVICES,
  checkCriticalEnv,
  formatCriticalEnvDiagnostic,
  type EnvRecord,
} from "@/lib/server/critical-env";

// Build a fully-populated env object so each test starts from "all green"
// and only the relevant vars are removed.
function fullEnv(extra: EnvRecord = {}): EnvRecord {
  const env: EnvRecord = {};
  for (const { vars } of CRITICAL_SERVICES) {
    for (const name of vars) env[name] = "placeholder";
  }
  return { ...env, ...extra };
}

describe("checkCriticalEnv — ok path", () => {
  it("returns ok when every critical var is present", () => {
    const check = checkCriticalEnv(fullEnv({ NODE_ENV: "production" }));
    expect(check.ok).toBe(true);
    expect(check.missing).toEqual([]);
    expect(check.unconfigured).toEqual([]);
  });
});

describe("checkCriticalEnv — missing detection", () => {
  it("flags openai when OPENAI_API_KEY is missing", () => {
    const env = fullEnv();
    delete env.OPENAI_API_KEY;
    const check = checkCriticalEnv(env);
    expect(check.ok).toBe(false);
    expect(check.unconfigured).toContain("openai");
    expect(check.missing).toContain("OPENAI_API_KEY");
  });

  it("flags resend when only MAIL_FROM is missing (still incomplete)", () => {
    const env = fullEnv();
    delete env.MAIL_FROM;
    const check = checkCriticalEnv(env);
    expect(check.unconfigured).toContain("resend");
    expect(check.missing).toEqual(["MAIL_FROM"]);
  });

  it("flags noon_app when both NOON_APP_* vars are empty strings", () => {
    const env = fullEnv({ NOON_APP_WEBHOOK_SECRET: "", NOON_APP_BASE_URL: "   " });
    const check = checkCriticalEnv(env);
    expect(check.unconfigured).toContain("noon_app");
    expect(check.missing).toEqual(["NOON_APP_WEBHOOK_SECRET", "NOON_APP_BASE_URL"]);
  });

  it("aggregates multiple missing services", () => {
    const env = fullEnv();
    delete env.OPENAI_API_KEY;
    delete env.V0_API_KEY;
    delete env.RESEND_API_KEY;
    const check = checkCriticalEnv(env);
    expect(check.unconfigured.sort()).toEqual(["openai", "resend", "v0"]);
    expect(check.missing).toEqual([
      "OPENAI_API_KEY",
      "V0_API_KEY",
      "RESEND_API_KEY",
    ]);
  });
});

describe("checkCriticalEnv — mode detection", () => {
  it("reports production-runtime when NODE_ENV=production and not building", () => {
    const env = fullEnv({ NODE_ENV: "production" });
    const check = checkCriticalEnv(env);
    expect(check.mode).toBe("production-runtime");
  });

  it("reports build during `next build` (NEXT_PHASE=phase-production-build)", () => {
    const env = fullEnv({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    });
    const check = checkCriticalEnv(env);
    expect(check.mode).toBe("build");
  });

  it("reports non-production in development", () => {
    const env = fullEnv({ NODE_ENV: "development" });
    const check = checkCriticalEnv(env);
    expect(check.mode).toBe("non-production");
  });

  it("reports non-production when NODE_ENV is undefined (CI vitest run)", () => {
    const env = fullEnv();
    delete env.NODE_ENV;
    const check = checkCriticalEnv(env);
    expect(check.mode).toBe("non-production");
  });
});

describe("formatCriticalEnvDiagnostic", () => {
  it("returns a positive line when everything is configured", () => {
    const env = fullEnv();
    const diag = formatCriticalEnvDiagnostic(checkCriticalEnv(env));
    expect(diag).toMatch(/all critical services configured/i);
  });

  it("mentions every unconfigured service and its missing vars", () => {
    const env = fullEnv();
    delete env.OPENAI_API_KEY;
    delete env.MAIL_FROM;
    const diag = formatCriticalEnvDiagnostic(checkCriticalEnv(env));
    expect(diag).toMatch(/openai \(missing OPENAI_API_KEY\)/);
    expect(diag).toMatch(/resend \(missing MAIL_FROM; present RESEND_API_KEY\)/);
  });
});
