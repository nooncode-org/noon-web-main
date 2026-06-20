-- B.5b (§9 attachments): the client_request_attachment OUTBOX.
--
-- A client attaches a file to one of their requests. NoonWeb hosts the bytes in
-- a PRIVATE Supabase Storage bucket (`blob_key` = the object key) and persists
-- this row as the durable record + dead-letter anchor, then forwards a
-- `client-request-update` with `kind:'attachment'` carrying a stable reference
-- (id + filename + mime + size) — never a URL (co-signed 2026-06-20). Staff fetch
-- the bytes via NoonWeb's HMAC signed-read, which mints a short-lived signed URL.
--
-- Mirrors the request/comment/update outboxes (024/023/027): the local row is the
-- source of truth; `forwarded_at IS NULL` is a self-auditing dead-letter.
-- Idempotency: `external_update_id` (== id) is the stable `updateId` the App
-- de-dupes on as `(externalRequestId, updateId)`, reused verbatim on retry.
--
-- `body` is the OPTIONAL note accompanying the file (clarification requires a
-- body; an attachment does not). `size_bytes` mirrors the co-signed 10 MB cap;
-- NoonWeb is authoritative on the real bytes, the App backstops the sub-shape.
--
-- Additive only; reversible via `DROP TABLE public.client_request_attachment`.
-- NOTE: the storage blobs are deleted separately (gdpr-hard-delete) — dropping
-- this table does not remove the objects in the bucket.

BEGIN;

CREATE TABLE IF NOT EXISTS client_request_attachment (
  id                    TEXT PRIMARY KEY,
  client_request_id     TEXT NOT NULL REFERENCES client_request(id) ON DELETE CASCADE,

  -- hosting (NoonWeb-owned):
  blob_key              TEXT NOT NULL,
  filename              TEXT NOT NULL,
  mime                  TEXT NOT NULL,
  size_bytes            INTEGER NOT NULL,
  body                  TEXT,

  -- outbox (forward to App's /client-request-update, kind:'attachment'):
  external_update_id    TEXT NOT NULL,
  forwarded_at          TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL,

  CONSTRAINT client_request_attachment_external_id_key UNIQUE (external_update_id),
  CONSTRAINT client_request_attachment_size_check CHECK (size_bytes BETWEEN 1 AND 10485760),
  CONSTRAINT client_request_attachment_filename_len_check CHECK (char_length(filename) BETWEEN 1 AND 255),
  CONSTRAINT client_request_attachment_body_len_check CHECK (body IS NULL OR char_length(body) BETWEEN 1 AND 4000)
);

CREATE INDEX IF NOT EXISTS idx_client_request_attachment_request
  ON client_request_attachment (client_request_id, created_at ASC);

-- Dead-letter sweep helper: cheaply find rows that never forwarded.
CREATE INDEX IF NOT EXISTS idx_client_request_attachment_unforwarded
  ON client_request_attachment (created_at)
  WHERE forwarded_at IS NULL;

ALTER TABLE IF EXISTS client_request_attachment ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE client_request_attachment FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE client_request_attachment TO service_role;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260620_028_client_request_attachment.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
