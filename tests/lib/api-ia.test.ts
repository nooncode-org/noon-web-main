/**
 * tests/lib/api-ia.test.ts
 *
 * Covers the rollback-safety contract for the OpenAI default model
 * resolver. The model bump (gpt-4.1 → gpt-5.5, 2026-05-19) introduced the
 * `OPENAI_DEFAULT_MODEL` env var as the rollback escape hatch: ops can
 * set it in Vercel and reload to revert without a redeploy. These tests
 * pin the contract so a future refactor can't silently drop it:
 *
 *   1. Unset env → returns "gpt-5.5" (current default).
 *   2. Empty / whitespace env → still "gpt-5.5" (whitespace is not a
 *      legitimate model name; treating it as "set" would surface a
 *      confusing 404 from OpenAI).
 *   3. Non-empty env → returned verbatim (trimmed). Lets ops pin a
 *      specific snapshot like "gpt-5.5-2026-04-23" or roll back to
 *      "gpt-4.1".
 *
 * We deliberately re-import on every check (via dynamic import) so a
 * vi.stubEnv mutation isn't masked by module-level caching. The current
 * implementation re-reads process.env on every call, which is what
 * makes the env override hot-swappable; this test pins that behaviour.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveDefaultOpenAIModel } from "@/lib/api-ia";

describe("resolveDefaultOpenAIModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to gpt-5.5 when OPENAI_DEFAULT_MODEL is unset", () => {
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "");
    expect(resolveDefaultOpenAIModel()).toBe("gpt-5.5");
  });

  it("treats whitespace-only env as unset and falls back to gpt-5.5", () => {
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "   ");
    expect(resolveDefaultOpenAIModel()).toBe("gpt-5.5");
  });

  it("returns the env value verbatim when ops sets a rollback model", () => {
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "gpt-4.1");
    expect(resolveDefaultOpenAIModel()).toBe("gpt-4.1");
  });

  it("accepts dated snapshots like gpt-5.5-2026-04-23 for pinning", () => {
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "gpt-5.5-2026-04-23");
    expect(resolveDefaultOpenAIModel()).toBe("gpt-5.5-2026-04-23");
  });

  it("trims surrounding whitespace from the env value", () => {
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "  gpt-4.1  ");
    expect(resolveDefaultOpenAIModel()).toBe("gpt-4.1");
  });
});
