-- B.4 rollback path enablement (the second half of version-linking). Re-emits
-- client_request.type's CHECK to include the 10th value `rollback`, symmetric with
-- the App's migration 0094 (`client_requests_type_check`, ADR-041).
--
-- Hard deploy order (cosign §4): this lands ONLY after the App has deployed its
-- own rollback CHECK + receiver (verified 2026-06-20 — App vocab + 0094 + the
-- receiver schema's `versionRef`-required-when-`rollback` refine). Paired with
-- flipping ROLLBACK_REQUEST_ENABLED = true (lib/maxwell/client-requests.ts): the
-- app layer only emits `rollback` once both this CHECK and the App are live.
--
-- `version_ref` itself (migration 025) is already applied — this migration only
-- widens the `type` allowlist. A re-emit (DROP + ADD) is required because Postgres
-- has no `ALTER ... ADD CONSTRAINT IF NOT EXISTS`; the runner applies each file
-- once (tracked in schema_migrations), so the DROP is safe.
--
-- Reversible (restore the 9-value CHECK below, safe once no row has type='rollback'):
--   ALTER TABLE client_request DROP CONSTRAINT client_request_type_check;
--   ALTER TABLE client_request ADD CONSTRAINT client_request_type_check CHECK (type IN (
--     'material','comment','bug','adjustment','support','improvement','feature','scope_change','incident'));

BEGIN;

ALTER TABLE client_request
  DROP CONSTRAINT client_request_type_check;

ALTER TABLE client_request
  ADD CONSTRAINT client_request_type_check CHECK (type IN (
    'material','comment','bug','adjustment','support','improvement','feature','scope_change','incident','rollback'));

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260620_026_client_request_rollback_type.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
