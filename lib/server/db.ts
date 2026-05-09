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

    const connectTimeoutSeconds = readPositiveIntEnv("DB_CONNECT_TIMEOUT_SECONDS", 20);
    const idleTimeoutSeconds = readPositiveIntEnv("DB_IDLE_TIMEOUT_SECONDS", 30);
    const maxConnections = readPositiveIntEnv("DB_MAX_CONNECTIONS", 10);

    globalForDb.postgresClient = postgres(url, {
      ssl: "require",
      max: maxConnections,
      idle_timeout: idleTimeoutSeconds,
      connect_timeout: connectTimeoutSeconds,
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
