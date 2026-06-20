-- B.5a (§9 clarification round-trip): the client_request_update OUTBOX.
--
-- When a client replies to one of their requests (typically one the App moved to
-- "Needs Clarification"), NoonWeb persists the reply HERE and forwards it
-- server-to-server to the App's receiver
-- (POST /api/integrations/website/client-request-update, §5D, ADR-042). The App
-- records it, returns the parent request to In Review, and notifies the team.
--
-- Mirrors the client_request outbox (migration 024) and the client_comment
-- outbox (023): the local row is the durable record; `forwarded_at IS NULL` is a
-- self-auditing dead-letter (App 5xx / receiver down / deterministic 4xx).
-- Idempotency: `external_update_id` is the stable per-update key the App de-dupes
-- on as `(externalRequestId, updateId)`. We set it = the row id, generated once,
-- and reuse it verbatim on every forward retry.
--
-- `kind` is constrained to 'clarification' — the only kind the App supports today
-- ('attachment' is B.5b, deferred behind file-hosting). Widen the CHECK additively
-- when attachments land.
--
-- Additive only; reversible via `DROP TABLE public.client_request_update`.

BEGIN;

CREATE TABLE IF NOT EXISTS client_request_update (
  id                    TEXT PRIMARY KEY,
  client_request_id     TEXT NOT NULL REFERENCES client_request(id) ON DELETE CASCADE,

  -- content (NoonWeb-owned, immutable after create):
  kind                  TEXT NOT NULL,
  body                  TEXT NOT NULL,

  -- outbox (forward to App's /client-request-update):
  external_update_id    TEXT NOT NULL,
  forwarded_at          TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL,

  CONSTRAINT client_request_update_external_id_key UNIQUE (external_update_id),
  CONSTRAINT client_request_update_body_len_check CHECK (char_length(body) BETWEEN 1 AND 4000),
  CONSTRAINT client_request_update_kind_check CHECK (kind IN ('clarification'))
);

CREATE INDEX IF NOT EXISTS idx_client_request_update_request
  ON client_request_update (client_request_id, created_at ASC);

-- Dead-letter sweep helper: cheaply find rows that never forwarded.
CREATE INDEX IF NOT EXISTS idx_client_request_update_unforwarded
  ON client_request_update (created_at)
  WHERE forwarded_at IS NULL;

ALTER TABLE IF EXISTS client_request_update ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE client_request_update FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE client_request_update TO service_role;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260620_027_client_request_update.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
