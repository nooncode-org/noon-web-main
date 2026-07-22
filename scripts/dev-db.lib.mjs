/**
 * scripts/dev-db.lib.mjs
 *
 * Schema bring-up shared by the embedded dev server and the CLI.
 *
 * Takes an `exec(sql)` that runs a multi-statement script and a `query(sql)`
 * that returns rows, so it works both against PGlite in-process and a real
 * Postgres over TCP.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Apply the greenfield baseline statement by statement.
 *
 * `schema.sql` ends with RLS + GRANT lines for the `website_upgrade_*` tables,
 * which are created by a LATER migration — so on a truly empty database its tail
 * references relations that don't exist yet, and the whole batch aborts. Those
 * lines are permissions only, and the migration that creates those tables grants
 * them again, so a missing-relation failure there is skipped rather than fatal.
 * Any other error still stops everything.
 *
 * Safe to split on `;` — the file is plain DDL with no function or DO bodies
 * (asserted below, so this stays true if someone adds one).
 */
async function applyBaseline(path, exec, log) {
  const text = readFileSync(path, "utf8");
  if (/\$\$|CREATE\s+(OR\s+REPLACE\s+)?FUNCTION|DO\s+\$/i.test(text)) {
    throw new Error(
      "supabase/schema.sql now contains a function or DO block; the statement splitter in dev-db.lib.mjs must be taught about dollar-quoting before it can run.",
    );
  }

  const statements = text
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s && !/^(--|\/\*)/.test(s.split(/\r?\n/).every((l) => l.trim().startsWith("--")) ? "--" : ""));

  let skipped = 0;
  for (const statement of statements) {
    // Strip comment-only fragments left by the split.
    if (statement.split(/\r?\n/).every((l) => !l.trim() || l.trim().startsWith("--"))) continue;
    try {
      await exec(`${statement};`);
    } catch (error) {
      const isPermission = /^(GRANT|REVOKE|ALTER\s+TABLE)/i.test(statement);
      if (error?.code === "42P01" && isPermission) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }
  if (skipped > 0) {
    log(`    (${skipped} permission statement(s) deferred to the migration that creates their tables)`);
  }
}

export function listMigrationFiles(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * Bring an empty (or partially migrated) database up to the current schema.
 *
 * `supabase/schema.sql` is the greenfield baseline and the migrations assume it:
 * the first migration is a preflight that SELECTs from tables it never creates.
 * So on an empty database the baseline goes down first, then every migration the
 * ledger hasn't recorded. Only ~2/3 of the files self-register, so the rest are
 * recorded here — otherwise every run would replay them.
 */
export async function ensureSchema({ root, exec, query, log = () => {} }) {
  const migrationsDir = join(root, "supabase", "migrations");

  const [{ t: hasBase }] = await query(`SELECT to_regclass('public.studio_session') AS t`);
  if (!hasBase) {
    log("  applying supabase/schema.sql (baseline) …");
    await applyBaseline(join(root, "supabase", "schema.sql"), exec, log);
  }

  const applied = async () => {
    const [{ t }] = await query(`SELECT to_regclass('public.schema_migrations') AS t`);
    if (!t) return new Set();
    const rows = await query(`SELECT filename FROM public.schema_migrations`);
    return new Set(rows.map((r) => r.filename));
  };

  const files = listMigrationFiles(migrationsDir);
  let done = await applied();
  let ran = 0;

  for (const file of files) {
    if (done.has(file)) continue;
    log(`  applying ${file} …`);
    await exec(readFileSync(join(migrationsDir, file), "utf8"));

    done = await applied();
    if (!done.has(file)) {
      const [{ t }] = await query(`SELECT to_regclass('public.schema_migrations') AS t`);
      if (t) {
        // Escape is unnecessary (filenames are ours) but kept literal-safe.
        await exec(
          `INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by)
           VALUES ('${file.replace(/'/g, "''")}', now(), NULL, 'dev-db:runner')
           ON CONFLICT (filename) DO NOTHING;`,
        );
        done.add(file);
      }
    }
    ran += 1;
  }

  return { total: files.length, ran };
}
