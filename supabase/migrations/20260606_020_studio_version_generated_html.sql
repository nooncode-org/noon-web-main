-- §5 cross-repo gap — persist the V0 prototype CODE per studio_version so it can
-- be forwarded to App on share (`prototype.generated_html`).
--
-- Context (handoff docs/handoff-piedra-2026-06-06-generated-html-code.md):
--   The post-payment pipeline on App (Opus, Iter 9) reads the approved prototipo
--   CODE from `prototype_workspaces.generated_html`. NoonWeb is the generation
--   layer but until now only persisted the V0 preview URL (`preview_url`) per
--   version — never the source code the V0 SDK returns in `latestVersion.files`.
--   Without the code, App receives `generated_html = null` and Opus cannot
--   preserve the approved design (escalates to a human).
--
-- This column stores the serialized V0 source (delimited per-file blocks) at the
-- moment the version is committed in the poll endpoint. `share-prototype` reads
-- the latest version's value and sends it as `prototype.generated_html`.
--
-- Naming: mirrors the cross-repo wire field `generated_html` for end-to-end
-- traceability, even though the value is component source, not standalone HTML
-- (the field name is App's, per the contract — see the handoff for the dual
-- semantics note).
--
-- Additive only: nullable, no default, no existing data modified. Pre-existing
-- studio_version rows (generated before this migration) stay NULL — the share
-- action sends `generated_html` only when present, so older sessions degrade
-- gracefully to the prior demo-url-only behaviour.
--
-- Locking: `ALTER TABLE ... ADD COLUMN` with no default on PostgreSQL >= 11 is
-- a metadata-only operation (no table rewrite). Reversible via
-- `ALTER TABLE public.studio_version DROP COLUMN generated_html`.

ALTER TABLE public.studio_version
  ADD COLUMN generated_html text;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260606_020_studio_version_generated_html.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;
