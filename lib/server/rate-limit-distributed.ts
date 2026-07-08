/**
 * lib/server/rate-limit-distributed.ts
 *
 * SEC-M5 (auditoría 2026-07): rate-limit cross-instance para las superficies
 * públicas de token (`/maxwell/proposal/[token]`, `/maxwell/prototipo/[token]`).
 *
 * El token-bucket de `lib/server/rate-limit.ts` es in-memory por instancia:
 * un scanner que reparte requests entre lambdas (o fuerza cold starts, que
 * nacen con el bucket lleno) lo bypasea. Este helper añade una segunda capa:
 * un contador fixed-window en Postgres (`rate_limit_counter`, migración 032),
 * atómico via INSERT ... ON CONFLICT ... hits+1.
 *
 * Capas:
 *   1. Bucket in-memory (existente) — absorbe bursts por instancia sin tocar
 *      la DB; si ya bloquea, ni consultamos Postgres.
 *   2. Contador compartido — el enforcement real cross-instance.
 *
 * Filosofía fail-open conservada: un error de DB en la capa 2 NO bloquea la
 * request (sin DB la página no puede servir nada útil de todas formas, y el
 * limiter es smoothing, no auth). La identidad se guarda hasheada
 * (sha256 truncado, mismo diseño que proposal_access_audit) — nunca IP cruda.
 */

import { createHash } from "node:crypto";
import { getDb } from "@/lib/server/db";
import { log } from "@/lib/server/logger";
import { consumeToken, type RateLimitResult } from "@/lib/server/rate-limit";

export type DistributedRateLimitOptions = {
  /** Familia lógica del bucket (p.ej. "proposal.public"). */
  namespace: string;
  /** Identidad cruda del caller (IP). Se hashea antes de persistir. */
  identityKey: string;
  /** Máximo de requests permitidas por ventana. */
  limit: number;
  /** Tamaño de la ventana en segundos. */
  windowSeconds: number;
};

/** Mismo esquema de privacidad que proposal_access_audit (migración 015). */
export function hashRateLimitIdentity(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

export async function consumeDistributedToken(
  opts: DistributedRateLimitOptions,
): Promise<RateLimitResult> {
  // Capa 1 — bucket in-memory por instancia (gratis, sin round-trip).
  const local = consumeToken({
    namespace: opts.namespace,
    capacity: opts.limit,
    refillPerSec: opts.limit / opts.windowSeconds,
    identityKey: opts.identityKey,
  });
  if (!local.ok) {
    return local;
  }

  // Capa 2 — contador fixed-window compartido en Postgres.
  try {
    const sql = getDb();
    const windowMs = opts.windowSeconds * 1000;
    const windowStartMs = Math.floor(Date.now() / windowMs) * windowMs;
    const windowStart = new Date(windowStartMs).toISOString();
    const identity = hashRateLimitIdentity(opts.identityKey);

    const rows = await sql<{ hits: number }[]>`
      INSERT INTO rate_limit_counter (namespace, identity, window_start, hits)
      VALUES (${opts.namespace}, ${identity}, ${windowStart}, 1)
      ON CONFLICT (namespace, identity, window_start)
      DO UPDATE SET hits = rate_limit_counter.hits + 1
      RETURNING hits
    `;

    const hits = Number(rows[0]?.hits ?? 1);
    if (hits > opts.limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((windowStartMs + windowMs - Date.now()) / 1000),
      );
      return { ok: false, retryAfterSeconds, remaining: 0 };
    }

    return { ok: true, retryAfterSeconds: 0, remaining: Math.max(0, opts.limit - hits) };
  } catch (error) {
    // Fail-open: el limiter distribuido nunca tumba una request legítima.
    log.warn("rate-limit.distributed", "Postgres counter failed — failing open", {
      namespace: opts.namespace,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: true, retryAfterSeconds: 0, remaining: 0 };
  }
}

/**
 * Barrido de ventanas viejas — lo invoca el reaper (F5-05). Borra toda ventana
 * cuyo fin quedó más de `olderThanSeconds` atrás (default 1h; las ventanas en
 * uso son de 60s, así que cualquier cosa >1h es basura segura).
 */
export async function sweepRateLimitCounters(olderThanSeconds = 3600): Promise<number> {
  const sql = getDb();
  const cutoff = new Date(Date.now() - olderThanSeconds * 1000).toISOString();
  const rows = await sql<{ count: string }[]>`
    WITH deleted AS (
      DELETE FROM rate_limit_counter
      WHERE window_start < ${cutoff}
      RETURNING 1
    )
    SELECT count(*)::text AS count FROM deleted
  `;
  return Number(rows[0]?.count ?? 0);
}
