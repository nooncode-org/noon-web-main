-- Fase A · Entrega 3 (E3.2) — the recipe of every generated prototype.
--
-- Spec §10: "Receta guardada por prototipo: referencias, ficha, fotos
-- elegidas (y de qué nivel salieron), decisión del cliente, orden final a
-- v0 — para diagnosticar sin adivinar y alimentar el futuro (salón de la
-- fama, perfil de gusto, telemetría)."
--
-- Own table rather than a column on studio_version: the recipe is written
-- when the generation is ORDERED (the route has every piece in hand), while
-- the version row is created later by the poll endpoint. Keyed by the v0
-- chat id so both sides can be joined after the fact.
--
-- Additive: nothing existing reads or writes this table, and a failed write
-- never blocks a generation (repositories.ts absorbs it).

BEGIN;

CREATE TABLE IF NOT EXISTS public.prototype_recipe (
  id                UUID PRIMARY KEY,
  studio_session_id TEXT NOT NULL,
  v0_chat_id        TEXT,
  recipe_json       JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prototype_recipe_session_idx
  ON public.prototype_recipe (studio_session_id, created_at DESC);

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260807_035_prototype_recipe.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
