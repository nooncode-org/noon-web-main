-- Project types vocabulary unification — Web ↔ App alignment.
--
-- Pre-2026-05-21 the web stored project_type values from the
-- 5-tuple `web_landing | ecommerce | webapp_system | mobile |
-- saas_ai_automation`. The App-side used a parallel-but-different
-- vocabulary: `landing | ecommerce | webapp | mobile | saas_ai`.
--
-- Owner decision 2026-05-21 (Mel): unify both repos to the App-side
-- spelling so the cross-repo contract no longer needs a translation
-- layer at the boundary. 3 of the 5 names change; the other 2
-- (ecommerce, mobile) were already identical.
--
-- This migration rewrites existing rows in `studio_session.project_type`
-- to the unified vocabulary. The column itself is plain TEXT (no
-- CHECK constraint, no ENUM type), so no DDL is required — only
-- one-shot data updates.
--
-- Mapping:
--   web_landing          -> landing
--   webapp_system        -> webapp
--   saas_ai_automation   -> saas_ai
--   ecommerce            -> ecommerce  (unchanged)
--   mobile               -> mobile      (unchanged)
--
-- Idempotency: each UPDATE is guarded by `WHERE project_type = '<old>'`
-- so re-running this migration after rows are already migrated is a
-- no-op (zero rows updated, no error).

UPDATE public.studio_session
   SET project_type = 'landing'
 WHERE project_type = 'web_landing';

UPDATE public.studio_session
   SET project_type = 'webapp'
 WHERE project_type = 'webapp_system';

UPDATE public.studio_session
   SET project_type = 'saas_ai'
 WHERE project_type = 'saas_ai_automation';

-- Self-register in schema_migrations (pattern established in B45 / migration 013).
INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260521_018_project_types_unify.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;
