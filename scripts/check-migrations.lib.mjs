/**
 * scripts/check-migrations.lib.mjs
 *
 * Pure helpers for the migrations drift check. Split out from the main script
 * so vitest can unit-test the file-scanning and diff logic without needing
 * a live database connection.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * @typedef {object} LocalMigration
 * @property {string} filename  Bare filename (no directory), e.g. `20260516_013_schema_migrations.sql`.
 * @property {string} checksum  Hex sha256 of the file contents at scan time.
 */

/**
 * @param {string} text
 * @returns {string}
 */
export function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Scan a directory for `.sql` files (non-recursive) and return their checksums.
 * Files are sorted lexicographically, which (per our naming convention
 * `YYYYMMDD_NNN_*.sql`) is also chronological.
 *
 * @param {string} dir  Absolute path to the migrations directory.
 * @returns {LocalMigration[]}
 */
export function listLocalMigrations(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((filename) => ({
      filename,
      checksum: sha256(readFileSync(join(dir, filename), "utf8")),
    }));
}

/**
 * Compare local files against the DB-applied set.
 *
 * `missing` = local files NOT in the DB ledger → drift that will break runtime
 *             unless the operator applies the SQL before deploy.
 * `orphans` = filenames in the DB ledger that no longer exist locally → suggests
 *             someone deleted or renamed a file. Surfaced as a warning (does
 *             NOT fail the build) because rolling back a migration is a
 *             legitimate (if rare) operation.
 *
 * @param {LocalMigration[]} local
 * @param {ReadonlySet<string>} appliedFilenames
 * @returns {{ missing: LocalMigration[]; orphans: string[] }}
 */
export function diffMigrations(local, appliedFilenames) {
  const localSet = new Set(local.map((m) => m.filename));
  return {
    missing: local.filter((m) => !appliedFilenames.has(m.filename)),
    orphans: [...appliedFilenames].filter((f) => !localSet.has(f)),
  };
}
