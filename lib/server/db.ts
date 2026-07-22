/**
 * lib/server/db.ts
 * Cliente postgres.js singleton para Supabase.
 * Usa globalThis para evitar agotar conexiones en desarrollo (Next.js HMR).
 */

import postgres from "postgres";

const globalForDb = globalThis as unknown as {
  postgresClient: postgres.Sql | undefined;
};

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getDb(): postgres.Sql {
  if (!globalForDb.postgresClient) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) {
      throw new Error("DATABASE_URL (or POSTGRES_URL) is not configured.");
    }

    // Un Postgres de desarrollo en la máquina (scripts/dev-db-server.mjs) habla
    // TCP plano: exigirle TLS impide levantar el portal en local. Cualquier URL
    // que no sea de loopback conserva `ssl: "require"` — producción nunca es
    // localhost, así que el endurecimiento remoto queda intacto.
    const isLoopback = /@(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(url);

    const connectTimeoutSeconds = readPositiveIntEnv("DB_CONNECT_TIMEOUT_SECONDS", 20);
    const idleTimeoutSeconds = readPositiveIntEnv("DB_IDLE_TIMEOUT_SECONDS", 30);
    // Ese mismo Postgres embebido atiende UNA conexión a la vez; un pool de 10
    // provoca ECONNRESET intermitentes. Sigue siendo configurable por entorno.
    const maxConnections = readPositiveIntEnv("DB_MAX_CONNECTIONS", isLoopback ? 1 : 10);

    globalForDb.postgresClient = postgres(url, {
      ssl: isLoopback ? false : "require",
      max: maxConnections,
      idle_timeout: idleTimeoutSeconds,
      connect_timeout: connectTimeoutSeconds,
      // SEC-M10 (auditoría 2026-07): Supabase transaction pooling (puerto 6543)
      // rompe con prepared statements — statements preparados en una conexión
      // pueden ejecutarse en otra. `prepare: false` es seguro también en session
      // mode (5432), así que se fija incondicionalmente en vez de depender del
      // puerto que elija ops. Ver .env.example (DATABASE_URL).
      prepare: false,
    });
  }
  return globalForDb.postgresClient;
}

// ----------------------------------------------------------------------------
// LEGACY (disabled 2026-05-08, gap #5):
//
// `ensureStudioSessionDeletedAtColumn` used to lazily run DDL at runtime to
// add the `deleted_at` column + partial index on `studio_session`. It was
// removed because:
//   1. Migration `20260430_011_studio_session_soft_delete.sql` is the
//      canonical source for that column and index.
//   2. Running DDL at runtime requires the runtime Postgres role to have
//      ALTER TABLE / CREATE INDEX privileges (a security smell).
//   3. It silently masked schema drift instead of failing loudly.
//
// Kept commented as a safety net. To revert:
//   - Uncomment the block below.
//   - Re-add `await ensureStudioSessionDeletedAtColumn();` at the top of:
//       lib/maxwell/repositories.ts → getStudioSession,
//                                     listStudioSessionsForOwner,
//                                     softDeleteStudioSession
//       lib/maxwell/prototype-quota.ts → evaluateInitialPrototypeCreate,
//                                        getPrototypeQuotaSnapshot
//   - The original (pre-removal) version of this file lives in git history.
// ----------------------------------------------------------------------------
//
// /** Idempotent guard so local DBs work before migrations are applied manually. */
// let studioSessionDeletedAtPatch: Promise<void> | null = null;
//
// export async function ensureStudioSessionDeletedAtColumn(): Promise<void> {
//   const sql = getDb();
//   if (!studioSessionDeletedAtPatch) {
//     studioSessionDeletedAtPatch = (async () => {
//       await sql`
//         ALTER TABLE studio_session
//         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL
//       `;
//       await sql`
//         CREATE INDEX IF NOT EXISTS idx_studio_session_owner_active
//         ON studio_session (owner_email, updated_at DESC)
//         WHERE deleted_at IS NULL
//       `;
//     })().catch((err) => {
//       studioSessionDeletedAtPatch = null;
//       throw err;
//     });
//   }
//   await studioSessionDeletedAtPatch;
// }
