-- B14 — GDPR Art. 17 ("right to be forgotten") hard-delete audit ledger.
--
-- Append-only log of every GDPR deletion executed by ops via
-- `scripts/gdpr-hard-delete.mjs`. Each row corresponds to one client
-- deletion request and captures (a) WHO ran it (operator + second
-- approver per the 2-person workflow in docs/gdpr-runbook.md), (b)
-- WHAT was deleted (counts per table + studio_session_ids cascaded),
-- (c) WHAT was PRESERVED for Stripe / accounting reconciliation (the
-- payment_intent_id and amount of every payment_event that got
-- cascade-deleted, anonymised — no email, no studio_session linkage
-- back), and (d) the path to the local snapshot file.
--
-- This table itself is NOT subject to GDPR Art. 17 — the operator's
-- name and the anonymised payment identifiers are operational records
-- needed to demonstrate compliance under Art. 30 ("records of
-- processing"). The deleted client's email is stored only as a
-- sha256-truncated hash (16 chars, same convention as
-- `proposal_access_audit.client_ip_hash` from B19).
--
-- Schema decisions:
--
-- 1. `email_hash` is sha256(email.lower().trim()).slice(0,16). No raw
--    email here. Hashing the email lets compliance answer "did we
--    process X's deletion?" without storing X's PII forever.
--
-- 2. `dry_run` boolean flag — every execution is logged, including
--    dry-runs. This gives ops a paper trail of every plan that was
--    considered (and lets us reconstruct "we promised to delete X on
--    DATE, did we actually do it?").
--
-- 3. `rows_affected_by_table` is JSONB { "studio_session": 3,
--    "contact_leads": 2, ... } — written post-execution so we can
--    diff dry-run plan vs real exec rows.
--
-- 4. `preserved_payment_records` is JSONB array of
--    [{ provider_payment_intent_id, amount_usd, currency, paid_at,
--    event_type }] captured from `payment_event` BEFORE the cascade.
--    Stripe Dashboard remains the source of truth; this column is a
--    local breadcrumb so future audits don't need to query Stripe.
--
-- 5. `snapshot_path` points to a local JSON dump of every row that
--    was about to be deleted. Stored under `./gdpr-snapshots/` (in
--    .gitignore). Required for rollback within minutes of an
--    accidental run before Supabase PITR window closes.
--
-- 6. `status` enum-via-CHECK: 'dry_run' | 'pending_approval' |
--    'executed' | 'failed' | 'rolled_back'. Same pattern as the other
--    state-machine tables in the repo. Future extension: add new
--    values via ALTER COLUMN drop+recreate.
--
-- 7. Self-registers in schema_migrations (B45 pattern).

CREATE TABLE IF NOT EXISTS public.gdpr_deletion_log (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash                  TEXT NOT NULL,
  dry_run                     BOOLEAN NOT NULL,
  status                      TEXT NOT NULL,
  operator_name               TEXT NOT NULL,
  second_approver_name        TEXT,
  studio_session_ids          TEXT[] NOT NULL DEFAULT '{}',
  rows_affected_by_table      JSONB NOT NULL DEFAULT '{}'::jsonb,
  preserved_payment_records   JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot_path               TEXT,
  started_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at                TIMESTAMPTZ,
  error_message               TEXT
);

ALTER TABLE public.gdpr_deletion_log
  ADD CONSTRAINT gdpr_deletion_log_status_valid
  CHECK (status IN ('dry_run', 'pending_approval', 'executed', 'failed', 'rolled_back'));

-- Index for the "show me all deletions for this email hash" compliance query.
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_log_email_hash
  ON public.gdpr_deletion_log (email_hash, started_at DESC);

-- Index for "show me all real executions in date range".
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_log_executed
  ON public.gdpr_deletion_log (started_at DESC)
  WHERE status = 'executed' AND dry_run = FALSE;

-- Self-register in schema_migrations (B45 pattern).
INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260519_016_gdpr_deletion_log.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;
