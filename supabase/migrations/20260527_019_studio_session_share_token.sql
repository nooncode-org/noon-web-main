-- ADR-028 D6 — D-upstream wire: studio_session share_token persistence.
--
-- Additive columns + partial indexes that let NoonWeb persist the App-issued
-- `share_token` returned by `POST /api/integrations/website/prototype-share`,
-- together with the workspace id it references, the composed client-facing
-- URL, and the timestamp of the share.
--
-- Schema rationale (per ADR-028 D6):
--   - App is the system of record for the share lifecycle (prototype_workspaces
--     + prototype_decisions live App-side). NoonWeb only needs the *current*
--     state per studio session to render the studio UI — never a history table.
--   - Regenerate semantics are 1:1 per session: when a seller regenerates V2,
--     the V1 token is superseded App-side and these columns are OVERWRITTEN
--     to point at V2. There is never a moment where one session holds two
--     live tokens.
--   - Soft-revert to pre-share is `SET share_token = NULL, prototype_shared_at
--     = NULL`. No history is lost on the App side.
--
-- Additive only: no column drops, no existing data modified, no NOT NULL.
-- Reversible via `drop column ... cascade` on the four columns; the partial
-- indexes drop with them.
--
-- Locking: `ALTER TABLE ... ADD COLUMN` with no default on PostgreSQL >= 11
-- is a metadata-only operation (no table rewrite, no AccessExclusiveLock held
-- during a scan). `CREATE INDEX` is blocking; given Maxwell's current write
-- volume on `studio_session` is low and prior migrations follow the same
-- convention (blocking, no `CONCURRENTLY`), blocking is acceptable here.
-- Future iterations on hotter tables should default to `CONCURRENTLY`.
--
-- Schema-migrations self-registration mirrors migration 018's pattern.

ALTER TABLE public.studio_session
  ADD COLUMN prototype_workspace_id uuid,
  ADD COLUMN share_token text,
  ADD COLUMN share_token_url text,
  ADD COLUMN prototype_shared_at timestamptz;

-- DB-level invariant: two studio_session rows cannot hold the same share_token.
-- App-side token generation should never produce duplicates (per ADR-023 D2 the
-- token is opaque + UUID-grade), but this index enforces it at the DB so any
-- App-side bug surfaces immediately on the Web side.
CREATE UNIQUE INDEX IF NOT EXISTS ux_studio_session_share_token
  ON public.studio_session(share_token)
  WHERE share_token IS NOT NULL;

-- Audit-query support: "which studio_session shared workspace X" without a
-- full table scan. Partial index excludes the (still empty post-migration)
-- rows and stays small as adoption ramps.
CREATE INDEX IF NOT EXISTS idx_studio_session_prototype_workspace
  ON public.studio_session(prototype_workspace_id)
  WHERE prototype_workspace_id IS NOT NULL;

-- Extend the studio_session.status CHECK constraint to allow the new
-- `prototype_shared` phase introduced by ADR-028 D7. The state machine in
-- `lib/maxwell/state-machine.ts` already enumerates this status; without
-- the DB-side CHECK extension, `updateStudioSessionStatus(_, 'prototype_shared')`
-- fails with a constraint violation at commit time. Idempotent via
-- `DROP CONSTRAINT IF EXISTS` so re-running on a DB where the constraint
-- already has `prototype_shared` is a no-op.
ALTER TABLE public.studio_session DROP CONSTRAINT IF EXISTS studio_session_status_check;
ALTER TABLE public.studio_session ADD CONSTRAINT studio_session_status_check
  CHECK (status = ANY (ARRAY[
    'intake'::text,
    'clarifying'::text,
    'generating_prototype'::text,
    'prototype_ready'::text,
    'revision_requested'::text,
    'revision_applied'::text,
    'prototype_shared'::text,
    'approved_for_proposal'::text,
    'proposal_pending_review'::text,
    'proposal_sent'::text,
    'converted'::text
  ]));

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260527_019_studio_session_share_token.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;
