-- Fase A · Entrega 2 (E2.1) — persist the client's confirmed visual direction.
--
-- The confirmation card (awaiting_direction status) pauses generation until
-- the client taps a direction. The tap must SURVIVE reloads and drive the
-- "dirección pegajosa" rule (confirmed once per session; corrections never
-- re-ask), so it lives on the session row, not in client state.
--
-- Additive and nullable on purpose (owner rule: modificar, no sobrescribir):
-- existing rows keep NULL, every existing query is untouched, and readers
-- treat NULL as "no direction chosen" — exactly today's behaviour. Only the
-- brain-flag path (MAXWELL_BRAIN_ENABLED) ever writes it.
--
-- Shape of direction_json (validated app-side, lib/maxwell/repositories.ts):
--   { "primaryUrl": "...", "source": "pool" | "client_url" | "client_images",
--     "confirmedAt": "<ISO>" }

BEGIN;

ALTER TABLE public.studio_session
  ADD COLUMN IF NOT EXISTS direction_json JSONB;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260806_034_studio_session_direction.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
