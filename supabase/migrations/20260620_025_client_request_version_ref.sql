-- B.4 (version-linking, §9): add the optional `version_ref` link from a client
-- request to a project version. Co-signed + FROZEN 2026-06-20
-- (docs/2026-06-20-app-to-noonweb-v3-b4-version-linking-cosign-response.md).
--
-- `version_ref` == the App's `versionSequenceNumber` (the same id used by the
-- Fase 2 Publish action, Slice 2b). It is NoonWeb-owned and IMMUTABLE after
-- create (like type/body): the client picks it once, it never changes. The App
-- resolves (projectId, version_ref) LAZILY staff-side and is *dangling-tolerant*
-- (no FK; a well-formed ref that doesn't resolve is still accepted + stored —
-- Q-B4-3), so this column intentionally carries NO foreign key.
--
-- Range CHECK mirrors the App's server-side backstop (1..100000, Q-B4 freeze
-- §1) so a malformed ref is rejected at the DB too; the server action validates
-- the same range first for a client-legible error.
--
-- THIS MIGRATION IS THE REFERENCE PATH ONLY. The `type = rollback` value
-- (10th value of client_request.type) is the ROLLBACK path and is deferred to a
-- separate migration applied only when the App confirms `rollback` is deployed
-- (hard deploy order, cosign §4). Until then the type CHECK from migration 024
-- stays at 9 values and the rollback path is gated off at the app layer
-- (ROLLBACK_REQUEST_ENABLED, lib/maxwell/client-requests.ts).
--
-- Additive + reversible (`DROP COLUMN version_ref`). Self-registers in
-- schema_migrations, mirroring 023/024.

BEGIN;

ALTER TABLE client_request
  ADD COLUMN IF NOT EXISTS version_ref INTEGER;

ALTER TABLE client_request
  ADD CONSTRAINT client_request_version_ref_check
  CHECK (version_ref IS NULL OR (version_ref >= 1 AND version_ref <= 100000));

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260620_025_client_request_version_ref.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
