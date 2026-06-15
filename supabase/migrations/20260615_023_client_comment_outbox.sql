-- Slice 1b of the v3 client portal: the client-comment OUTBOX.
--
-- The authenticated client workspace (app/[locale]/maxwell/workspace/[sessionId])
-- lets the client post a message. This table is the LOCAL source of truth for
-- that message log — the project-status signed-read (Slice 1a) does NOT return
-- comments, so the client's log lives here. Each row is then forwarded
-- server-to-server to App's interim receiver
-- (POST /api/integrations/website/client-comment) via postNoonAppWebhook.
--
-- Idempotency: `external_comment_id` is the stable key App de-dupes on. We set
-- it = the row id, generated once, and reuse it verbatim on every forward retry
-- so a replay returns App's same comment id (persisted in noon_app_comment_id
-- for reconciliation/audit).
--
-- Delivery state is self-auditing: a row with `forwarded_at IS NULL` is a
-- dead-letter (App 5xx / receiver not yet deployed / deterministic 4xx). The
-- structured logger records the failure; no separate audit table is needed
-- (the local row IS the durable record, per the plan §3.3 / §4 Slice 1b).
--
-- Mirrors the maxwell baseline table conventions (TEXT PK + FK, TIMESTAMPTZ,
-- RLS deny-by-default + service_role grant — see migration 010). Additive only.
-- Reversible via `DROP TABLE public.client_comment`.

BEGIN;

CREATE TABLE IF NOT EXISTS client_comment (
  id                   TEXT PRIMARY KEY,
  client_workspace_id  TEXT NOT NULL REFERENCES client_workspace(id) ON DELETE CASCADE,
  body                 TEXT NOT NULL,
  external_comment_id  TEXT NOT NULL,
  noon_app_comment_id  TEXT,
  forwarded_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL,

  CONSTRAINT client_comment_external_id_key UNIQUE (external_comment_id),
  CONSTRAINT client_comment_body_len_check CHECK (char_length(body) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_client_comment_workspace
  ON client_comment (client_workspace_id, created_at ASC);

-- Dead-letter sweep helper: cheaply find rows that never forwarded.
CREATE INDEX IF NOT EXISTS idx_client_comment_unforwarded
  ON client_comment (created_at)
  WHERE forwarded_at IS NULL;

ALTER TABLE IF EXISTS client_comment ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE client_comment FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE client_comment TO service_role;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260615_023_client_comment_outbox.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
