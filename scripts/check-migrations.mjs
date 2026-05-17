#!/usr/bin/env node
/**
 * scripts/check-migrations.mjs
 *
 * B45 — Migrations drift check.
 *
 * Compares `supabase/migrations/*.sql` (the source of truth in git) against the
 * `public.schema_migrations` ledger in the target database. Exits non-zero in
 * --strict mode when a local file has not been applied yet.
 *
 * Designed to run as a pre-build hook (`prebuild` in package.json), gated on
 * the CHECK_MIGRATIONS=1 env var so local dev / preview builds without a
 * reachable DB do NOT break.
 *
 * Usage:
 *   node scripts/check-migrations.mjs                      # report-only (exit 0 on drift)
 *   node scripts/check-migrations.mjs --strict             # exit 1 on drift
 *   CHECK_MIGRATIONS=1 node scripts/check-migrations.mjs   # opt-in mode
 *
 * Env:
 *   DATABASE_URL or POSTGRES_URL  — postgres connection string (required when CHECK_MIGRATIONS=1).
 *   CHECK_MIGRATIONS=1            — opt-in gate. When unset, the script is a no-op
 *                                   (prints a single line and exits 0). This keeps
 *                                   the prebuild hook safe to enable globally.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { diffMigrations, listLocalMigrations } from "./check-migrations.lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

async function main() {
  const strict = process.argv.includes("--strict");

  // Gate: only run when explicitly enabled. Without this, dev builds without a
  // DATABASE_URL would all fail at `npm run build`.
  if (process.env.CHECK_MIGRATIONS !== "1") {
    console.log(
      "[check-migrations] Skipped (CHECK_MIGRATIONS!=1). Set CHECK_MIGRATIONS=1 to enable.",
    );
    return;
  }

  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error("[check-migrations] CHECK_MIGRATIONS=1 but DATABASE_URL is not set.");
    process.exit(1);
  }

  const local = listLocalMigrations(MIGRATIONS_DIR);
  if (local.length === 0) {
    console.error(`[check-migrations] No .sql files found under ${MIGRATIONS_DIR}.`);
    process.exit(1);
  }

  const sql = postgres(url, { ssl: "require", max: 1, connect_timeout: 5 });
  let appliedRows;
  try {
    appliedRows = await sql`SELECT filename FROM public.schema_migrations`;
  } catch (err) {
    console.error("[check-migrations] Could not read schema_migrations:", err.message);
    console.error(
      "  Has the bootstrap migration (20260516_013_schema_migrations.sql) been applied yet?",
    );
    process.exit(1);
  } finally {
    await sql.end();
  }

  const appliedSet = new Set(appliedRows.map((r) => r.filename));
  const { missing, orphans } = diffMigrations(local, appliedSet);

  if (orphans.length > 0) {
    console.warn(
      `[check-migrations] WARN — ${orphans.length} ledger row(s) reference files not present in git:`,
    );
    for (const f of orphans) console.warn(`  - ${f}`);
  }

  if (missing.length === 0) {
    console.log(`[check-migrations] OK — all ${local.length} local migrations applied.`);
    return;
  }

  console.error(
    `[check-migrations] DRIFT — ${missing.length} migration(s) NOT yet applied to the DB:`,
  );
  for (const m of missing) {
    console.error(`  - ${m.filename}  (sha256=${m.checksum.slice(0, 12)}…)`);
  }
  console.error("");
  console.error("  Apply them with:  psql $DATABASE_URL -f supabase/migrations/<file>.sql");
  console.error("  Then record:      INSERT INTO public.schema_migrations(filename, checksum, applied_by)");
  console.error("                     VALUES ('<file>', '<sha256>', 'manual:<operator>');");

  if (strict) process.exit(1);
}

main().catch((err) => {
  console.error("[check-migrations] Unexpected error:", err);
  process.exit(1);
});
