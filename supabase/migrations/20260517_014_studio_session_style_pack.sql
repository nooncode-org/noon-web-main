-- Bloque 11 (B-quality-layer) — persist classified visual style family per studio session.
--
-- A StylePack id (e.g. "tech-digital", "warm-artisanal") is chosen by
-- lib/maxwell/style-classifier.ts the first time a prototype is generated for
-- a session, and reused by every subsequent correction so the visual identity
-- stays consistent across iterations.
--
-- No FK: the catalogue of 24 packs lives in TypeScript (lib/maxwell/style-packs.ts);
-- treating it as a DB table would add a join + migration churn every time we
-- tune the catalogue. The trade-off is that a typo here is undetected until
-- runtime, but `getStylePackById()` falls back gracefully when the id is
-- unknown.

ALTER TABLE public.studio_session
  ADD COLUMN IF NOT EXISTS style_pack_id TEXT;

-- Self-register in the schema_migrations ledger introduced in 013. This is
-- the first new migration after the ledger landed, so it documents the
-- pattern for future ones: every migration ends with an INSERT into
-- schema_migrations so check-migrations.mjs doesn't flag it as drift.
INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260517_014_studio_session_style_pack.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;
