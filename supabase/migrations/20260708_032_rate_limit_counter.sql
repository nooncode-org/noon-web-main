-- SEC-M5 (auditoría master 2026-07, Ola E-2): contador fixed-window compartido
-- para el anti-scanner de tokens públicos.
--
-- El limiter token-bucket de lib/server/rate-limit.ts es in-memory: cada
-- instancia serverless arranca con el bucket lleno, así que un scanner que
-- reparta requests entre instancias (o fuerce cold starts) lo bypasea. Este
-- contador vive en Postgres — que ya está en el hot path de esas páginas — y
-- da enforcement real cross-instance sin infra nueva (regla del repo: nada de
-- Redis/Upstash sin necesidad concreta).
--
-- Diseño:
--   * PK (namespace, identity, window_start); el guard hace
--     INSERT ... ON CONFLICT ... SET hits = hits + 1 RETURNING hits — atómico
--     entre instancias, una única round-trip.
--   * `identity` = hash de IP truncado (sha256(ip).slice(0,16)), el mismo
--     diseño de privacidad que proposal_access_audit (migración 015): nunca
--     IP cruda.
--   * Fixed window (no sliding): suficiente contra scanners; el burst máximo
--     teórico en el borde de ventana es 2× el límite, absorbido porque la capa
--     1 (bucket in-memory por instancia) sigue delante.
--   * Limpieza: el reaper (F5-05, misma iteración) borra ventanas viejas.
--     Sin TTL nativo en Postgres; la tabla es de churn bajo (solo superficies
--     públicas de token).
--
-- Reversible via `DROP TABLE public.rate_limit_counter`.

BEGIN;

CREATE TABLE IF NOT EXISTS rate_limit_counter (
  namespace     TEXT NOT NULL,
  identity      TEXT NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  hits          INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT rate_limit_counter_pkey PRIMARY KEY (namespace, identity, window_start)
);

-- Barrido del reaper: "borra toda ventana anterior a X" sin scan completo.
CREATE INDEX IF NOT EXISTS idx_rate_limit_counter_window
  ON rate_limit_counter (window_start);

ALTER TABLE IF EXISTS rate_limit_counter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE rate_limit_counter FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE rate_limit_counter TO service_role;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260708_032_rate_limit_counter.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
