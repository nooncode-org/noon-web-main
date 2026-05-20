-- G-D2 — LLM budget tracking ledger.
--
-- Append-only log of every LLM call (OpenAI, Anthropic, v0) made by the
-- website runtime. Used as anomaly detection: with the existing
-- GLOBAL_MONTHLY_INITIAL_PROTOTYPES = 15 cap in lib/maxwell/prototype-quota,
-- legitimate monthly spend tops out around $35-50/month. A $200/month
-- hard-stop (configurable via LLM_BUDGET_USD_PER_MONTH env) only ever
-- fires if something abnormal is happening — bug retry loop, abuse path,
-- provider price change. Soft alerts at 50% and 80% give early warning.
--
-- Multi-provider design:
--   `provider` and `model` are TEXT so we can record OpenAI, Anthropic
--   (Opus / Sonnet / Haiku), v0, and any future provider without schema
--   migrations. The pricing table lives in TS (`lib/server/llm-pricing.ts`)
--   so price updates ship via PR, not migration.
--
-- Multi-repo scope:
--   This table tracks ONLY the website (noon-web-main). The App
--   (App-nooncode) has its own Maxwell features and consumes the same
--   providers — its usage is invisible here. Recommended belt-and-suspenders:
--   set per-API-key hard limits in the provider dashboards (OpenAI's
--   "Hard limit" feature in the project settings). This local tracker
--   gives granular per-category visibility that provider dashboards lack.
--
-- Schema decisions:
--
-- 1. `period_month` is a DATE truncated to the first of the month. Lets
--    the monthly aggregation query be a single equality filter:
--      SELECT SUM(cost_usd) WHERE period_month = date_trunc('month', now())
--    Indexed jointly with created_at DESC for "show me this month's
--    spend by category over time".
--
-- 2. `category` is TEXT (not enum) so adding a new caller doesn't need
--    a migration. Current values:
--      'chat', 'brief_extractor', 'style_classifier',
--      'proposal_generator', 'upgrade_analyzer', 'upgrade_generator',
--      'v0_prototype_create', 'v0_prototype_update', 'unlabeled'
--    A grep of `recordLLMCall(` is the source of truth.
--
-- 3. `cost_usd` is NUMERIC(12, 6) — six decimal places lets us record
--    fractions of a cent without rounding (a brief extraction with
--    gpt-4.1-mini is ~$0.0001). 12 total digits caps individual call
--    cost at $999,999.99 which is impossible in practice.
--
-- 4. `request_id` is optional — if the caller has a stable id (e.g.
--    studio_session_id + turn index), they pass it for traceability.
--    If null, the row is still useful for the aggregate sum.
--
-- 5. `metadata_json` is the catch-all for extra context (eg. retry count,
--    finish reason, prompt fingerprint). Bounded by application logic
--    to small payloads — never store the full prompt.
--
-- 6. Self-registers in schema_migrations (B45 pattern).

CREATE TABLE IF NOT EXISTS public.llm_budget_usage (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month        DATE NOT NULL,
  provider            TEXT NOT NULL,
  model               TEXT NOT NULL,
  category            TEXT NOT NULL,
  input_tokens        INTEGER,
  output_tokens       INTEGER,
  cost_usd            NUMERIC(12, 6) NOT NULL,
  request_id          TEXT,
  metadata_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for the hot path: assertBudgetAvailable() does a SUM over the
-- current month. Equality filter on period_month, no range scan.
CREATE INDEX IF NOT EXISTS idx_llm_budget_period
  ON public.llm_budget_usage (period_month, created_at DESC);

-- Index for the diagnostic query: "show me this month's spend by
-- category" — equality + group-by friendly.
CREATE INDEX IF NOT EXISTS idx_llm_budget_period_category
  ON public.llm_budget_usage (period_month, category);

-- Index for provider-specific investigations (e.g. "did the Anthropic
-- price increase hit us?").
CREATE INDEX IF NOT EXISTS idx_llm_budget_period_provider
  ON public.llm_budget_usage (period_month, provider);

-- Self-register in schema_migrations (B45 pattern).
INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260520_017_llm_budget_usage.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;
