-- Cross-repo AI MVP pipeline milestones receiver (handoff
-- App-nooncode/docs/handoffs/2026-06-06-noonweb-ai-mvp-milestones-handoff.md).
--
-- Context:
--   After the client pays the activation, App runs a post-payment pipeline
--   (Opus) that improves the approved prototipo into the first functional MVP.
--   As that run crosses client-relevant states, App emits client-safe
--   milestones to NoonWeb over the same durable HMAC-signed outbound queue that
--   powers proposal-review-decision (ADR-027). NoonWeb must receive, dedup, and
--   acknowledge (2xx) each milestone.
--
--   §58 boundary (cardinal): the milestone body carries ONLY three things —
--   `kind`, `project_id` (App's internal project UUID), and — for
--   `version-ready` only — a `version_url`. It NEVER carries pipeline internals
--   (validation history, escalation reason, cost, attempt counts, step output).
--   This table mirrors that minimal shape by construction.
--
-- This table is the durable dedup store AND the persistence the future
-- client-status UI reads. Dedup is structural: the unique (project_id, kind)
-- constraint matches App's idempotency key `aimvp-milestone:<project_id>:<kind>`
-- (stable per project+kind), so a retried delivery is an upsert no-op and the
-- receiver always returns 2xx.
--
--   project_id  : App's project UUID (opaque to NoonWeb today — NoonWeb does not
--                 yet persist the mapping back to a studio_session; that is the
--                 follow-up PR-B). Stored as text to avoid coupling to App's id
--                 format.
--   kind        : 'started' | 'version-ready' | 'escalated' (§19.3 copy keys).
--   version_url : preview URL, present only on 'version-ready' and only when App
--                 has resolved one; otherwise NULL.
--
-- Additive only: brand-new table, no existing data touched. Reversible via
-- `DROP TABLE public.ai_mvp_milestone`.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_mvp_milestone (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('started', 'version-ready', 'escalated')),
  version_url text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_mvp_milestone_project_kind_key UNIQUE (project_id, kind)
);

-- Lookups by project when the UI (PR-B) renders the latest milestone for a
-- given project. The UNIQUE constraint above already covers (project_id, kind).
CREATE INDEX IF NOT EXISTS ai_mvp_milestone_project_id_idx
  ON public.ai_mvp_milestone (project_id);

-- Backend-only access, mirroring 20260406_004_secure_maxwell_tables.sql: the app
-- reaches this table via the server-side DATABASE_URL connection, never the
-- anon/authenticated Supabase client roles.
ALTER TABLE public.ai_mvp_milestone ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_mvp_milestone FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.ai_mvp_milestone TO service_role;

COMMIT;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260606_021_ai_mvp_milestone.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;
