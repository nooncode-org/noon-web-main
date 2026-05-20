/**
 * lib/server/llm-pricing.ts
 *
 * G-D2 — Pricing table for LLM-budget cost calculations.
 *
 * Source of truth for "how much did THAT call cost us?" Pricing is
 * stored in TS (not DB) so updates ship via PR + code review, not via
 * a migration race that could quietly under-charge a category.
 *
 * Unit: ALL prices are USD per 1 million tokens. Helper functions
 * convert to per-call cost. Prices reflect public provider pricing as
 * of 2026-05-19; ALWAYS cross-check the provider dashboard before a
 * cost-bearing decision (we don't poll provider APIs for live pricing).
 *
 * Multi-provider coverage:
 *   - OpenAI: gpt-5.5, gpt-4.1, gpt-4.1-mini (the 3 models actually
 *     used by website per the codebase grep)
 *   - Anthropic: claude-opus-4, claude-sonnet-4, claude-haiku-4 (not
 *     wired today, but the spec confirmed they're on the roadmap)
 *   - v0: per-generation pricing (not token-based; the v0 SDK doesn't
 *     surface token counts, so we approximate via FLAT_GENERATION_COST)
 *
 * Unknown model fallback:
 *   `estimateCallCostUsd()` returns 0 + warns when the model is not in
 *   the table. Choice: better to UNDER-report than to crash the budget
 *   tracker on an unknown identifier. The warning surfaces in logs so
 *   ops can add the missing entry.
 */

/**
 * Per-token pricing in USD per 1 million tokens.
 * `flatPerCall` overrides the token math when set (used by v0 which
 * charges per-image-generation, not per-token).
 */
export type LLMPricing = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  /** When set, the helper returns this value regardless of token counts. */
  flatPerCall?: number;
};

export type LLMProvider = "openai" | "anthropic" | "v0";

/**
 * Pricing matrix keyed by `${provider}:${model}`. Lookup is exact-string
 * — no fuzzy matching, no normalisation. If a model echoes back from
 * the API with a date suffix (e.g. "gpt-5.5-2026-04-23"), add the
 * dated row explicitly.
 *
 * 2026-05-19 prices verified against:
 *   - https://openai.com/pricing (OpenAI section)
 *   - https://anthropic.com/pricing (Anthropic section)
 *   - v0 docs (Premium / Pro tier)
 */
export const LLM_PRICING: Readonly<Record<string, LLMPricing>> = {
  // ── OpenAI ────────────────────────────────────────────────────────────────
  "openai:gpt-5.5": {
    inputUsdPerMillion: 5.0,
    outputUsdPerMillion: 30.0,
  },
  "openai:gpt-5.5-2026-04-23": {
    // Dated snapshot of gpt-5.5 — same pricing as the alias.
    inputUsdPerMillion: 5.0,
    outputUsdPerMillion: 30.0,
  },
  "openai:gpt-4.1": {
    inputUsdPerMillion: 2.5,
    outputUsdPerMillion: 10.0,
  },
  "openai:gpt-4.1-mini": {
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
  },

  // ── Anthropic (Opus / Sonnet / Haiku, 2026 lineup) ────────────────────────
  "anthropic:claude-opus-4": {
    inputUsdPerMillion: 15.0,
    outputUsdPerMillion: 75.0,
  },
  "anthropic:claude-sonnet-4": {
    inputUsdPerMillion: 3.0,
    outputUsdPerMillion: 15.0,
  },
  "anthropic:claude-haiku-4": {
    inputUsdPerMillion: 0.8,
    outputUsdPerMillion: 4.0,
  },

  // ── v0 (per-generation) ───────────────────────────────────────────────────
  // The v0 SDK does NOT expose token counts in the response. We charge a
  // flat estimate per generation. Adjust this number if v0 publishes a
  // breakdown later. Current estimate based on typical prototype +
  // correction cost observed in early 2026.
  "v0:default": {
    inputUsdPerMillion: 0,
    outputUsdPerMillion: 0,
    flatPerCall: 0.3,
  },
};

/**
 * Compute the cost of a single LLM call in USD.
 *
 * Pure function — does NOT touch DB, does NOT log, does NOT throw on
 * unknown models. Returns 0 + sets a `priceLookupSucceeded: false` flag
 * on unknown models so the caller can decide what to do (the budget
 * tracker logs a warning and stores the row anyway so we still see the
 * call happened).
 */
export function estimateCallCostUsd(input: {
  provider: LLMProvider;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): { cost: number; priceLookupSucceeded: boolean } {
  const key = `${input.provider}:${input.model}`;
  const pricing = LLM_PRICING[key];

  if (!pricing) {
    return { cost: 0, priceLookupSucceeded: false };
  }

  if (pricing.flatPerCall !== undefined) {
    return { cost: pricing.flatPerCall, priceLookupSucceeded: true };
  }

  const inputCost =
    ((input.inputTokens ?? 0) * pricing.inputUsdPerMillion) / 1_000_000;
  const outputCost =
    ((input.outputTokens ?? 0) * pricing.outputUsdPerMillion) / 1_000_000;

  return { cost: inputCost + outputCost, priceLookupSucceeded: true };
}

/**
 * Convenience: list every model the website might call. Useful for
 * dashboards / sanity checks (e.g. "are we accidentally calling a
 * model not in the pricing table?").
 */
export function listKnownPricingKeys(): readonly string[] {
  return Object.keys(LLM_PRICING);
}
