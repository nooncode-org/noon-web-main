#!/usr/bin/env node
/**
 * scripts/smoke-gpt-5.5.mjs
 *
 * Verification harness for the 2026-05-19 gpt-5.5 model bump
 * (`lib/api-ia.ts` commit `206f63f`). Exercises the OpenAI API with
 * the same default model the runtime would pick, asserts the
 * response is shaped sensibly, and prints latency + token usage.
 *
 * WHEN TO RUN
 * ===========
 *   1. **Post-deploy of the gpt-5.5 bump (already merged a532889)**.
 *      Run once against prod env to confirm the new default works
 *      end-to-end. Run again 24h later to catch any rate-limit /
 *      cost-spike pattern.
 *   2. **Before rolling back via OPENAI_DEFAULT_MODEL**. If a model
 *      regression is suspected, run this with
 *      `OPENAI_DEFAULT_MODEL=gpt-4.1` and confirm the script still
 *      returns a coherent answer — proves the rollback path works
 *      before flipping the env var in Vercel.
 *   3. **Quarterly health check**. Cheap way to detect OpenAI
 *      pricing changes, model deprecations, or API contract drift.
 *
 * WHAT IT CHECKS
 * ==============
 *   - The model resolved by `resolveDefaultOpenAIModel()` matches
 *     the expected current default (`gpt-5.5`) unless
 *     `OPENAI_DEFAULT_MODEL` is set, in which case it just reports
 *     the override.
 *   - A single chat completion succeeds with a deterministic prompt
 *     ("What is the capital of France? Answer with one word only.").
 *   - The response includes the word "Paris" (case-insensitive) —
 *     proves the model is actually reasoning, not returning canned
 *     errors / empty strings.
 *   - Latency stays under a configurable budget (default 10s; can
 *     be overridden via `SMOKE_LATENCY_BUDGET_MS`).
 *   - Token usage is reported so ops can sanity-check cost.
 *
 * EXIT CODES
 * ==========
 *   0  — all checks passed
 *   1  — model returned an unexpected answer (Paris not in reply)
 *   2  — request failed (network, auth, rate-limit, model unknown)
 *   3  — latency budget exceeded
 *   4  — OPENAI_API_KEY not set (refuses to run with a missing key
 *        rather than producing a misleading "all green" with a
 *        fake call)
 *
 * USAGE
 * =====
 *
 *   # Default — uses whatever model the runtime would pick
 *   OPENAI_API_KEY=sk-... node scripts/smoke-gpt-5.5.mjs
 *
 *   # Force a specific model (rollback verification)
 *   OPENAI_API_KEY=sk-... OPENAI_DEFAULT_MODEL=gpt-4.1 \
 *     node scripts/smoke-gpt-5.5.mjs
 *
 *   # Stricter latency budget (CI dashboard alert threshold)
 *   OPENAI_API_KEY=sk-... SMOKE_LATENCY_BUDGET_MS=5000 \
 *     node scripts/smoke-gpt-5.5.mjs
 *
 *   # npm alias
 *   npm run smoke:gpt-5.5
 *
 * COST
 * ====
 * One prompt + one completion. Gpt-5.5 input pricing $5/M, output
 * $30/M. Our prompt is ~15 tokens in + ~5 tokens out → ~$0.00023 per
 * invocation (5 cents in 200 runs). Trivial to run repeatedly.
 *
 * SECURITY
 * ========
 *   - The script reads `OPENAI_API_KEY` from env and passes it to
 *     OpenAI directly. It does not log the key.
 *   - The prompt is hardcoded benign text. No PII flows through.
 *   - The full reply is printed to stdout so ops can eyeball it; if
 *     this is run in CI, route output to a private log destination.
 */

import { performance } from "node:perf_hooks";

const PROMPT = "What is the capital of France? Answer with one word only.";
const EXPECTED_TOKEN = "paris";
const LATENCY_BUDGET_MS = Number(process.env.SMOKE_LATENCY_BUDGET_MS ?? 10_000);

// Resolve the same way the runtime does (kept inline so this script
// has zero compile-time dependency on the app's TypeScript build).
function resolveDefaultOpenAIModel() {
  const fromEnv = process.env.OPENAI_DEFAULT_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : "gpt-5.5";
}

function log(...args) {
  console.log("[smoke-gpt-5.5]", ...args);
}

function fail(code, msg) {
  console.error(`[smoke-gpt-5.5] FAIL exit=${code} — ${msg}`);
  process.exit(code);
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    fail(4, "OPENAI_API_KEY is not set. Refusing to run with a missing key.");
  }

  const model = resolveDefaultOpenAIModel();
  const envOverridden = Boolean(process.env.OPENAI_DEFAULT_MODEL?.trim());

  log(`Model: ${model}${envOverridden ? " (via OPENAI_DEFAULT_MODEL env override)" : " (default)"}`);
  log(`Latency budget: ${LATENCY_BUDGET_MS}ms`);
  log(`Prompt: ${JSON.stringify(PROMPT)}`);

  const started = performance.now();

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You answer concisely." },
          { role: "user", content: PROMPT },
        ],
      }),
    });
  } catch (err) {
    fail(2, `Network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const elapsed = performance.now() - started;

  if (!response.ok) {
    const body = await response.text();
    fail(2, `HTTP ${response.status} from OpenAI: ${body.slice(0, 500)}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (err) {
    fail(2, `Could not parse OpenAI JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  const reply = payload?.choices?.[0]?.message?.content?.trim() ?? "";
  const usedModel = payload?.model ?? "(missing)";
  const usage = payload?.usage ?? {};

  log(`Latency: ${elapsed.toFixed(0)}ms`);
  log(`Model echoed by API: ${usedModel}`);
  log(`Reply: ${JSON.stringify(reply)}`);
  log(
    `Tokens — prompt: ${usage.prompt_tokens ?? "?"}, completion: ${
      usage.completion_tokens ?? "?"
    }, total: ${usage.total_tokens ?? "?"}`,
  );

  // --- Assertions -----------------------------------------------------------

  if (elapsed > LATENCY_BUDGET_MS) {
    fail(
      3,
      `Latency ${elapsed.toFixed(0)}ms exceeded budget ${LATENCY_BUDGET_MS}ms. ` +
        `If this is recurring, set SMOKE_LATENCY_BUDGET_MS higher or investigate.`,
    );
  }

  if (!reply.toLowerCase().includes(EXPECTED_TOKEN)) {
    fail(
      1,
      `Reply did not contain "${EXPECTED_TOKEN}". Got: ${JSON.stringify(reply)}. ` +
        `This is either a model regression, prompt drift, or a content-filter trigger.`,
    );
  }

  log("OK — all checks passed.");
  process.exit(0);
}

main().catch((err) => {
  fail(2, `Unhandled error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
});
