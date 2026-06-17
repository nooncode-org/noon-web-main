-- Slice A of the v3 client-request system (§9): the client_request OUTBOX +
-- the App-owned client-visible state projection.
--
-- The authenticated client workspace (app/[locale]/maxwell/workspace/[sessionId])
-- lets a payment-activated client submit a TYPED request (9 types, 5 declared
-- priorities, 1..4000-char body). This table is the LOCAL source of truth for
-- the client's request log. Each row is forwarded server-to-server to App's
-- receiver (POST /api/integrations/website/client-request) via postNoonAppWebhook.
--
-- Column ownership encodes the frozen Q-1 contract
-- (docs/v3-client-requests-noonweb-design.md):
--   * CONTENT (type, client_priority, body, submitted_by) — NoonWeb writes it
--     once at create and never again.
--   * PROJECTION (client_visible_state, state_revision, state_updated_at) —
--     App-owned. Written ONLY by the outbound state receiver (Slice B), never
--     derived by NoonWeb. `client_visible_state` starts NULL (the UI renders
--     NULL as "Received" copy) and `state_revision` guards monotonicity: a state
--     push only applies when its revision strictly exceeds state_revision.
--
-- Idempotency: `external_request_id` is the stable key App de-dupes on. We set
-- it = the row id, generated once, and reuse it verbatim on every forward retry.
--
-- Delivery state is self-auditing: a row with `forwarded_at IS NULL` is a
-- dead-letter (App 5xx / receiver not yet deployed / deterministic 4xx). The
-- local row IS the durable record — no separate audit table (mirrors Slice 1b's
-- client_comment outbox, migration 023).
--
-- This is NOT an extension of client_comment: §9 coexists with the interim
-- comment outbox until the B.6 fold (Q-7). Additive only; reversible via
-- `DROP TABLE public.client_request`.

BEGIN;

CREATE TABLE IF NOT EXISTS client_request (
  id                    TEXT PRIMARY KEY,
  client_workspace_id   TEXT NOT NULL REFERENCES client_workspace(id) ON DELETE CASCADE,

  -- content (NoonWeb-owned, immutable after create):
  type                  TEXT NOT NULL,
  client_priority       TEXT NOT NULL,
  body                  TEXT NOT NULL,
  submitted_by          TEXT NOT NULL,

  -- create outbox (forward to App's /client-request):
  external_request_id   TEXT NOT NULL,
  forwarded_at          TIMESTAMPTZ,

  -- client-visible projection (App-owned; written only by the outbound receiver):
  client_visible_state  TEXT,
  state_revision        INTEGER NOT NULL DEFAULT 0,
  state_updated_at      TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL,

  CONSTRAINT client_request_external_id_key UNIQUE (external_request_id),
  CONSTRAINT client_request_body_len_check CHECK (char_length(body) BETWEEN 1 AND 4000),
  CONSTRAINT client_request_state_revision_check CHECK (state_revision >= 0),
  CONSTRAINT client_request_type_check CHECK (type IN (
    'material','comment','bug','adjustment','support','improvement','feature','scope_change','incident')),
  CONSTRAINT client_request_priority_check CHECK (client_priority IN (
    'critical','high','normal','low','backlog')),
  CONSTRAINT client_request_state_check CHECK (
    client_visible_state IS NULL OR client_visible_state IN (
      'received','in_review','in_progress','completed','under_internal_review'))
);

CREATE INDEX IF NOT EXISTS idx_client_request_workspace
  ON client_request (client_workspace_id, created_at ASC);

-- Dead-letter sweep helper: cheaply find rows that never forwarded.
CREATE INDEX IF NOT EXISTS idx_client_request_unforwarded
  ON client_request (created_at)
  WHERE forwarded_at IS NULL;

ALTER TABLE IF EXISTS client_request ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE client_request FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE client_request TO service_role;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260617_024_client_request.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
