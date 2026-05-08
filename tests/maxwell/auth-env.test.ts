/**
 * tests/maxwell/auth-env.test.ts
 *
 * Validates the production fail-fast of `auth.ts` against missing
 * AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET. The check is exposed via the pure
 * `checkAuthEnv()` helper so we can exercise it without re-importing the
 * module under different env combinations.
 */

import { describe, expect, it } from "vitest";
import { checkAuthEnv } from "@/lib/auth/env";

const validEnv = {
  AUTH_GOOGLE_ID: "id",
  AUTH_GOOGLE_SECRET: "secret",
};

describe("checkAuthEnv", () => {
  it("returns ok when both Google vars are present in any mode", () => {
    expect(
      checkAuthEnv({ ...validEnv, NODE_ENV: "production" } as NodeJS.ProcessEnv),
    ).toEqual({ ok: true, missing: [], mode: "production-runtime" });
  });

  it("flags production-runtime when missing in production runtime", () => {
    const res = checkAuthEnv({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
    expect(res.ok).toBe(false);
    expect(res.missing).toEqual(["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"]);
    expect(res.mode).toBe("production-runtime");
  });

  it("downgrades to 'build' mode during next build (NEXT_PHASE)", () => {
    const res = checkAuthEnv({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    } as NodeJS.ProcessEnv);
    expect(res.ok).toBe(false);
    expect(res.mode).toBe("build");
  });

  it("treats dev / test as non-production", () => {
    expect(checkAuthEnv({ NODE_ENV: "development" } as NodeJS.ProcessEnv).mode).toBe(
      "non-production",
    );
    expect(checkAuthEnv({ NODE_ENV: "test" } as NodeJS.ProcessEnv).mode).toBe(
      "non-production",
    );
  });

  it("treats whitespace-only values as missing", () => {
    const res = checkAuthEnv({
      AUTH_GOOGLE_ID: "  ",
      AUTH_GOOGLE_SECRET: "secret",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);
    expect(res.ok).toBe(false);
    expect(res.missing).toEqual(["AUTH_GOOGLE_ID"]);
    expect(res.mode).toBe("production-runtime");
  });

  it("reports both vars when both empty", () => {
    const res = checkAuthEnv({
      AUTH_GOOGLE_ID: "",
      AUTH_GOOGLE_SECRET: "",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);
    expect(res.missing).toEqual(["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"]);
  });
});
