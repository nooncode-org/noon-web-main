-- PR-B of the AI MVP milestones handoff: map App's project_id back to a local
-- workspace so the client-status UI can render the milestones PR-A persists.
--
-- Context:
--   The milestone receiver (migration 0021) stores milestones keyed by App's
--   internal `project_id`, which NoonWeb otherwise never persisted. App already
--   returns that `projectId` in its payment-confirmed response
--   (App/lib/server/website-integration.ts), but NoonWeb discarded it.
--
--   This column captures it on the post-payment workspace (1:1 with the studio
--   session) at confirmation time. The client workspace page
--   (app/[locale]/maxwell/workspace/[sessionId]) reads it and looks up the
--   milestones via getAiMvpMilestonesByProjectId(project_id) to render the
--   §19.3 client copy.
--
--   Nullable: pre-payment workspaces and any confirmation where App did not
--   return a project_id stay NULL, and the UI simply renders no milestone banner
--   (graceful degradation — the existing workspace timeline is unaffected).
--
-- Additive only: nullable, no default, no existing data modified. Reversible via
-- `ALTER TABLE public.client_workspace DROP COLUMN noon_app_project_id`.

ALTER TABLE public.client_workspace
  ADD COLUMN noon_app_project_id text;

-- Reverse lookup (project_id -> workspace) is not needed today (the UI goes
-- session -> workspace -> project_id), but a partial index keeps a future
-- "find the workspace for this milestone" path cheap and is near-free here.
CREATE INDEX IF NOT EXISTS client_workspace_noon_app_project_id_idx
  ON public.client_workspace (noon_app_project_id)
  WHERE noon_app_project_id IS NOT NULL;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260606_022_client_workspace_noon_app_project_id.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;
