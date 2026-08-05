/**
 * tests/maxwell/model-seats.test.ts
 *
 * Pins the Fase A seat contract (lib/maxwell/model-seats.ts):
 *
 *   1. Defaults — orchestrator = gpt-5.6-sol, executor = gpt-5.6-luna
 *      (the owner's constitution: best model decides, cheap model
 *      executes complete orders).
 *   2. Env overrides — MAXWELL_MODEL_* swaps a seat with one variable
 *      and zero code; whitespace-only counts as unset (a whitespace
 *      model name would surface as a confusing 404 from OpenAI).
 *   3. Pricing parity — every seat DEFAULT has a row in LLM_PRICING, so
 *      the budget ledger never records $0-cost calls for the models we
 *      ship seated. (Env overrides are ops' responsibility; the table
 *      warns on unknowns.)
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveExecutorModel,
  resolveOrchestratorModel,
} from "@/lib/maxwell/model-seats";
import { LLM_PRICING } from "@/lib/server/llm-pricing";

describe("model seats", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("orchestrator defaults to gpt-5.6-sol", () => {
    vi.stubEnv("MAXWELL_MODEL_ORCHESTRATOR", "");
    expect(resolveOrchestratorModel()).toBe("gpt-5.6-sol");
  });

  it("executor defaults to gpt-5.6-luna", () => {
    vi.stubEnv("MAXWELL_MODEL_EXECUTOR", "");
    expect(resolveExecutorModel()).toBe("gpt-5.6-luna");
  });

  it("treats whitespace-only env as unset", () => {
    vi.stubEnv("MAXWELL_MODEL_ORCHESTRATOR", "   ");
    vi.stubEnv("MAXWELL_MODEL_EXECUTOR", "   ");
    expect(resolveOrchestratorModel()).toBe("gpt-5.6-sol");
    expect(resolveExecutorModel()).toBe("gpt-5.6-luna");
  });

  it("env override swaps a seat verbatim (trimmed)", () => {
    vi.stubEnv("MAXWELL_MODEL_ORCHESTRATOR", "  gpt-5.5  ");
    vi.stubEnv("MAXWELL_MODEL_EXECUTOR", "gpt-5.6-terra");
    expect(resolveOrchestratorModel()).toBe("gpt-5.5");
    expect(resolveExecutorModel()).toBe("gpt-5.6-terra");
  });

  it("every default seat model has a pricing row (no $0-cost ledger rows)", () => {
    vi.stubEnv("MAXWELL_MODEL_ORCHESTRATOR", "");
    vi.stubEnv("MAXWELL_MODEL_EXECUTOR", "");
    for (const model of [resolveOrchestratorModel(), resolveExecutorModel()]) {
      expect(
        LLM_PRICING[`openai:${model}`],
        `openai:${model} missing from LLM_PRICING`,
      ).toBeDefined();
    }
  });
});
