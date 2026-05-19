# gpt-5.5 model bump — smoke verification runbook

**Companion to:** `scripts/smoke-gpt-5.5.mjs`
**Related code:** `lib/api-ia.ts` → `resolveDefaultOpenAIModel()` (commit `206f63f`)
**Last updated:** 2026-05-19

---

## Why this runbook exists

The 2026-05-19 bump moved the default OpenAI chat model used across
Maxwell from `gpt-4.1` → `gpt-5.5`. The bump is hot-swappable via the
`OPENAI_DEFAULT_MODEL` env var (no redeploy needed for rollback),
which means **the only way to know it's working in production is to
exercise it**. This script + runbook is that verification.

The script is intentionally minimal: one prompt, one completion,
hard-asserts on a deterministic answer ("Paris"). Per-invocation cost
~$0.00023 — trivial to run as often as you want.

---

## Quick start

```bash
# Local — uses the production OpenAI key from your .env.local
OPENAI_API_KEY=sk-... npm run smoke:gpt-5.5

# Or one-shot
OPENAI_API_KEY=sk-... node scripts/smoke-gpt-5.5.mjs
```

Expected output (happy path):

```
[smoke-gpt-5.5] Model: gpt-5.5 (default)
[smoke-gpt-5.5] Latency budget: 10000ms
[smoke-gpt-5.5] Prompt: "What is the capital of France? Answer with one word only."
[smoke-gpt-5.5] Latency: 842ms
[smoke-gpt-5.5] Model echoed by API: gpt-5.5-2026-04-23
[smoke-gpt-5.5] Reply: "Paris"
[smoke-gpt-5.5] Tokens — prompt: 23, completion: 1, total: 24
[smoke-gpt-5.5] OK — all checks passed.
```

Exit code `0` = all good. Non-zero = see [Exit codes](#exit-codes).

---

## When to run

| Trigger | What to run | Why |
|---|---|---|
| **Right after the merge `206f63f` ships to prod** | `npm run smoke:gpt-5.5` once | Confirm the env-driven default actually resolved to `gpt-5.5` in the deployed Vercel env. |
| **24h after the merge** | Same | Catches model deprecation or rate-limit patterns that only appear under sustained traffic. |
| **Before any rollback decision** | `OPENAI_DEFAULT_MODEL=gpt-4.1 npm run smoke:gpt-5.5` | Proves the rollback path works BEFORE you set the env var in Vercel — you don't want to discover a bad fallback during an outage. |
| **Quarterly health check** | Same | Cheap canary for OpenAI pricing / model lineup changes. |
| **After any OpenAI maintenance window** | Same | Surfaces API contract drift early. |

---

## Run against production

Two safe options. Pick based on access you have.

### Option A — From your laptop, pointing at the prod OpenAI key

This is what most ops will do. Requires you to temporarily have the
production `OPENAI_API_KEY` value in your shell environment.

```bash
# 1. Grab the prod key (Vercel dashboard → settings → environment variables → OPENAI_API_KEY)
# 2. DO NOT commit it. Use the shell only:
OPENAI_API_KEY="<prod_key_paste>" npm run smoke:gpt-5.5

# 3. Clear it from your shell history after:
history -d $(history 1 | awk '{print $1}')   # bash
```

Privacy note: the script logs the model name + reply to stdout. The
key itself is never logged. Still, run it in a private terminal.

### Option B — As a Vercel build-time check

Vercel exposes env vars at build time. You could add a CI workflow
that runs the script during deploy — but that couples the deploy
pipeline to OpenAI uptime, which is undesirable for a smoke test.
Recommendation: keep this manual / scheduled out-of-band.

---

## Exit codes

| Code | Meaning | Action |
|---|---|---|
| `0` | All checks passed | None — log the run + carry on. |
| `1` | Model responded but the answer didn't contain "Paris" (case-insensitive) | Possible model regression, prompt drift, or content-filter trigger. Re-run twice; if persistent, escalate to OpenAI support. Do NOT roll back yet — this is one prompt. |
| `2` | Request failed (network, auth, rate-limit, model unknown) | Check the printed HTTP body. Common causes: bad key, billing on hold, model name typo via `OPENAI_DEFAULT_MODEL`. |
| `3` | Latency exceeded budget (default 10s) | One-off slow request is normal. Sustained slowness = monitor (Sentry latency for `maxwell.*` scopes). Raise the budget via `SMOKE_LATENCY_BUDGET_MS` if your normal is higher. |
| `4` | `OPENAI_API_KEY` not set | You forgot to export the key. No action needed besides re-running with it set. |

---

## Rollback runbook (gpt-5.5 → gpt-4.1)

If smoke run shows a clear regression (exit 1 reproducible across 3+
runs, or exit 2 with model-unknown messages), the rollback is one
env-var change in Vercel — no redeploy needed because
`resolveDefaultOpenAIModel()` reads `process.env` on every call.

```
1. Vercel dashboard → noon-web → Settings → Environment Variables
2. Add (or edit if it exists) OPENAI_DEFAULT_MODEL = gpt-4.1
   Scope: Production (and Preview if you want a coherent fallback there too)
3. Save. Wait ~30s for the env propagation.
4. Verify locally with the same key:
   OPENAI_API_KEY=<prod_key> OPENAI_DEFAULT_MODEL=gpt-4.1 npm run smoke:gpt-5.5
5. Confirm the reply still contains "Paris" and the API echoed model
   starts with "gpt-4.1".
```

Forward rollback (restore gpt-5.5 after the issue is fixed): delete
the env var (or set it back to `gpt-5.5`).

For pinning to a specific snapshot (e.g. when OpenAI deprecates the
alias): set `OPENAI_DEFAULT_MODEL=gpt-5.5-2026-04-23` — the dated
snapshot doesn't move.

---

## Cost reference

| Model | Input ($/M tokens) | Output ($/M tokens) | Cost per smoke run |
|---|---|---|---|
| gpt-5.5 | $5.00 | $30.00 | ~$0.00023 |
| gpt-4.1 | $2.50 | $10.00 | ~$0.00011 |

These are 2026-04 publishedrates. Always cross-check
https://openai.com/pricing before assuming.

---

## What NOT to use this for

- **Load testing.** One request per invocation. For latency-under-load,
  use a dedicated tool.
- **Output quality evaluation.** The script just checks for "Paris". A
  proper eval would run a battery of prompts, score correctness +
  hallucination + adherence, and trend over time. That's a separate
  workstream.
- **Replacing real monitoring.** Sentry / Vercel logs + the structured
  logger emissions from `maxwell.*` scopes remain the source of truth
  for production behaviour. This script is a one-shot canary, not a
  dashboard.
