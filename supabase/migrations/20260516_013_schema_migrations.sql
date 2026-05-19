-- B45 — Schema migrations ledger.
--
-- Tracks which SQL migration files have been applied to this database so the
-- pre-build check script (`scripts/check-migrations.mjs`) can detect when a
-- migration is checked into git but has not yet been applied to the target
-- environment. Without this ledger, forgotten migrations only surface at
-- runtime via cryptic "column does not exist" errors after deploy.
--
-- Schema decisions:
--   - `filename` is the PK (stable across reorderings of the directory).
--   - `checksum` is nullable because the 14 pre-existing migrations are
--     backfilled here without a deterministic source-of-truth checksum
--     (some prod-applied files may have drifted from git). Going forward,
--     new rows SHOULD record sha256(file_at_apply_time) so future drift
--     between git and prod is detectable.
--   - `applied_by` is free-form text describing who/what applied the
--     migration: `manual:<operator>` for hand-run `psql -f`, `ci:<runner>`
--     for automation, `bootstrap:b45` for this initial backfill.
--   - No `version` integer: we already encode chronological order in the
--     filename prefix (`YYYYMMDD_NNN_*.sql`).

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum TEXT,
  applied_by TEXT
);

-- Bootstrap: mark every migration up to and including this one as applied.
-- Without this seed, the very first run of `check-migrations.mjs` would flag
-- all 14 historical files as missing. Timestamps reuse the filename date
-- prefix because real apply times are unrecoverable.
INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260406_000_preflight_maxwell_schema.sql',       '2026-04-06 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260406_001_harden_maxwell_schema.sql',          '2026-04-06 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260406_002_proposal_runtime_hardening.sql',     '2026-04-06 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260406_003_expand_proposal_review_actions.sql', '2026-04-06 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260406_004_secure_maxwell_tables.sql',          '2026-04-06 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260406_005_maxwell_google_auth_ownership.sql',  '2026-04-06 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260406_006_review_auth_and_workspace_statuses.sql', '2026-04-06 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260407_007_contact_abuse_hardening.sql',        '2026-04-07 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260412_008_website_upgrade.sql',                '2026-04-12 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260412_009_website_upgrade_crawl_done.sql',     '2026-04-12 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260424_010_studio_message_feedback.sql',        '2026-04-24 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260425_001_noon_app_integration_events.sql',    '2026-04-25 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260430_011_studio_session_soft_delete.sql',     '2026-04-30 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260511_012_stripe_checkout.sql',                '2026-05-11 00:00:00+00', NULL, 'bootstrap:b45'),
  ('20260516_013_schema_migrations.sql',              now(),                    NULL, 'bootstrap:b45')
ON CONFLICT (filename) DO NOTHING;
