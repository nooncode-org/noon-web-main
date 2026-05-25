/**
 * tests/maxwell/runtime-env.test.ts
 *
 * Validates the boot-time fail-fast for runtime service credentials wired by
 * `instrumentation.ts`. Exercises the pure helpers from `lib/server/runtime-env`
 * across all four service buckets (OpenAI, V0, Resend, NoonApp) and across the
 * three modes (production-runtime, build, non-production).
 */

import { describe, expect, it } from "vitest";
import {
  assertRuntimeEnvForProduction,
  checkRuntimeEnv,
  formatRuntimeEnvReport,
} from "@/lib/server/runtime-env";

const allValidEnv = {
  OPENAI_API_KEY: "openai-key",
  V0_API_KEY: "v0-key",
  RESEND_API_KEY: "resend-key",
  MAIL_FROM: "noreply@example.com",
  MAIL_PROVIDER: "resend",
  NOON_APP_BASE_URL: "https://noon-app.example.com",
  NOON_WEBSITE_WEBHOOK_SECRET: "shared-secret",
  NODE_ENV: "production",
} as NodeJS.ProcessEnv;

describe("checkRuntimeEnv", () => {
  it("returns ok when all critical and optional vars are present", () => {
    const r = checkRuntimeEnv(allValidEnv);
    expect(r.ok).toBe(true);
    expect(r.criticalMissing).toEqual([]);
    expect(r.optionalMissing).toEqual([]);
    expect(r.mode).toBe("production-runtime");
  });

  it("reports missing OpenAI as critical", () => {
    const env = { ...allValidEnv, OPENAI_API_KEY: "" };
    const r = checkRuntimeEnv(env);
    expect(r.ok).toBe(false);
    expect(r.criticalMissing.map((c) => c.service)).toEqual(["OpenAI"]);
    expect(r.criticalMissing[0]?.missing).toEqual(["OPENAI_API_KEY"]);
  });

  it("reports missing V0 as critical", () => {
    const env = { ...allValidEnv, V0_API_KEY: "" };
    const r = checkRuntimeEnv(env);
    expect(r.ok).toBe(false);
    expect(r.criticalMissing.map((c) => c.service)).toEqual(["V0"]);
  });

  it("reports partial Resend missing (MAIL_FROM only)", () => {
    const env = { ...allValidEnv, MAIL_FROM: "" };
    const r = checkRuntimeEnv(env);
    expect(r.ok).toBe(false);
    const resend = r.criticalMissing.find((c) => c.service === "Resend");
    expect(resend?.missing).toEqual(["MAIL_FROM"]);
  });

  it("reports NoonApp as optional missing (does NOT mark report as failed)", () => {
    const env = {
      ...allValidEnv,
      NOON_APP_BASE_URL: "",
      NOON_WEBSITE_WEBHOOK_SECRET: "",
    };
    const r = checkRuntimeEnv(env);
    expect(r.ok).toBe(true); // critical paths still ok
    expect(r.criticalMissing).toEqual([]);
    expect(r.optionalMissing.map((c) => c.service)).toEqual(["NoonApp"]);
    expect(r.optionalMissing[0]?.missing).toEqual([
      "NOON_APP_BASE_URL",
      "NOON_WEBSITE_WEBHOOK_SECRET",
    ]);
  });

  it("accepts the canonical NOON_WEBSITE_WEBHOOK_SECRET (cross-repo v1)", () => {
    const env = {
      ...allValidEnv,
      NOON_WEBSITE_WEBHOOK_SECRET: "shared-secret-canonical",
    };
    const r = checkRuntimeEnv(env);
    expect(r.ok).toBe(true);
    expect(r.optionalMissing).toEqual([]);
    const noonApp = r.checks.find((c) => c.service === "NoonApp");
    expect(noonApp?.ok).toBe(true);
    expect(noonApp?.missing).toEqual([]);
  });

  it("treats whitespace-only canonical secret as missing", () => {
    const env = {
      ...allValidEnv,
      NOON_WEBSITE_WEBHOOK_SECRET: "   ",
    };
    const r = checkRuntimeEnv(env);
    expect(r.ok).toBe(true); // optional, doesn't block production
    expect(r.optionalMissing.map((c) => c.service)).toEqual(["NoonApp"]);
    expect(r.optionalMissing[0]?.missing).toEqual(["NOON_WEBSITE_WEBHOOK_SECRET"]);
  });

  it("treats whitespace-only values as missing", () => {
    const env = { ...allValidEnv, OPENAI_API_KEY: "   " };
    const r = checkRuntimeEnv(env);
    expect(r.ok).toBe(false);
    expect(r.criticalMissing[0]?.missing).toEqual(["OPENAI_API_KEY"]);
  });

  it("detects build mode via NEXT_PHASE", () => {
    const env = {
      ...allValidEnv,
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    } as NodeJS.ProcessEnv;
    expect(checkRuntimeEnv(env).mode).toBe("build");
  });

  it("treats dev / test as non-production", () => {
    expect(
      checkRuntimeEnv({ NODE_ENV: "development" } as NodeJS.ProcessEnv).mode,
    ).toBe("non-production");
    expect(
      checkRuntimeEnv({ NODE_ENV: "test" } as NodeJS.ProcessEnv).mode,
    ).toBe("non-production");
  });
});

describe("assertRuntimeEnvForProduction", () => {
  it("does not throw when all critical vars are present in production", () => {
    expect(() => assertRuntimeEnvForProduction(allValidEnv)).not.toThrow();
  });

  it("throws when critical vars are missing in production-runtime", () => {
    const env = { ...allValidEnv, OPENAI_API_KEY: "", V0_API_KEY: "" };
    expect(() => assertRuntimeEnvForProduction(env)).toThrow(
      /Runtime env check failed for production/,
    );
    expect(() => assertRuntimeEnvForProduction(env)).toThrow(/OpenAI/);
    expect(() => assertRuntimeEnvForProduction(env)).toThrow(/V0/);
  });

  it("does NOT throw during build phase even when critical missing", () => {
    const env = {
      OPENAI_API_KEY: "",
      V0_API_KEY: "",
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    } as NodeJS.ProcessEnv;
    expect(() => assertRuntimeEnvForProduction(env)).not.toThrow();
  });

  it("does NOT throw outside production even when critical missing", () => {
    const env = { OPENAI_API_KEY: "", NODE_ENV: "development" } as NodeJS.ProcessEnv;
    expect(() => assertRuntimeEnvForProduction(env)).not.toThrow();
  });

  it("does NOT throw when only optional (NoonApp) is missing in production", () => {
    const env = {
      ...allValidEnv,
      NOON_APP_BASE_URL: "",
      NOON_WEBSITE_WEBHOOK_SECRET: "",
    };
    expect(() => assertRuntimeEnvForProduction(env)).not.toThrow();
  });
});

describe("formatRuntimeEnvReport", () => {
  it("includes mode and per-service status lines", () => {
    const env = {
      ...allValidEnv,
      OPENAI_API_KEY: "",
      NOON_APP_BASE_URL: "",
      NOON_WEBSITE_WEBHOOK_SECRET: "",
    };
    const txt = formatRuntimeEnvReport(checkRuntimeEnv(env));
    expect(txt).toMatch(/mode=production-runtime/);
    expect(txt).toMatch(/\[FAIL\] OpenAI \(critical\) — missing OPENAI_API_KEY/);
    expect(txt).toMatch(/\[ok\] V0 \(critical\) — configured/);
    expect(txt).toMatch(/\[warn\] NoonApp \(optional\) — missing/);
    expect(txt).toMatch(/NOON_WEBSITE_WEBHOOK_SECRET/);
  });
});
