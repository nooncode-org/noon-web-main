-- Receiver-side idempotency ledger for App's proposal-review-decision webhook
-- (cross-repo contract §7.6, App-nooncode/docs/integrations/cross-repo-webhook-v1.md).
--
-- Since G23/ADR-027 the App actively retries failed deliveries (inline retries,
-- a */5 cron sweeper, and admin replays that spawn NEW ledger rows carrying the
-- SAME key), so the same logical decision can reach this receiver more than
-- once. Every POST carries `X-Noon-Idempotency-Key: <external_proposal_id>:<decision>`.
-- The receiver contract (§7.6) requires:
--   1. read the key on every POST;
--   2. persist it under a UNIQUE constraint;
--   3. on a duplicate, return 200 with the SAME response body as the first
--      successful processing — no re-emitted emails, no re-transitioned state.
--
-- `response_body` stores the exact JSON returned by the first successful
-- processing so the replay in (3) is byte-equivalent. Only 2xx outcomes are
-- recorded (a 4xx/5xx must stay retryable/dead-letterable on the App side).
--
-- Mirrors the maxwell baseline table conventions (TIMESTAMPTZ, RLS
-- deny-by-default + service_role grant — see migration 010). Additive only.
-- Reversible via `DROP TABLE public.proposal_review_decision_received`.

BEGIN;

CREATE TABLE IF NOT EXISTS proposal_review_decision_received (
  id                    TEXT PRIMARY KEY,
  idempotency_key       TEXT NOT NULL,
  external_proposal_id  TEXT NOT NULL,
  decision              TEXT NOT NULL CHECK (decision IN ('approved', 'changes_requested', 'rejected', 'cancelled')),
  response_body         JSONB NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL,

  CONSTRAINT proposal_review_decision_received_key_unique UNIQUE (idempotency_key)
);

-- Operator triage: all recorded decisions for a proposal, newest first.
CREATE INDEX IF NOT EXISTS idx_review_decision_received_proposal
  ON proposal_review_decision_received (external_proposal_id, created_at DESC);

ALTER TABLE IF EXISTS proposal_review_decision_received ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE proposal_review_decision_received FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE proposal_review_decision_received TO service_role;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260708_031_proposal_review_decision_received.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
