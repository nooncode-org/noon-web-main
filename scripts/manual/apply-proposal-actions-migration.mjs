/**
 * scripts/manual/apply-proposal-actions-migration.mjs
 *
 * Applies ONE migration — 20260808_036_proposal_review_actions_realign.sql — to
 * whatever database DATABASE_URL points at, and proves it worked.
 *
 * Why a script instead of `npm run db:migrate`: that runner applies EVERY
 * unapplied file it finds. Against production that is a much bigger action than
 * the one being approved, and nobody should discover the difference afterwards.
 * This applies exactly one file, refuses to run twice, and prints the constraint
 * before and after so the change is visible rather than assumed.
 *
 * Why it exists at all: pointing an agent at production credentials is the wrong
 * shape. The operator runs this; the connection string never leaves the machine.
 *
 * WHAT IT CHANGES: the list of things that may be recorded in a proposal's
 * history. Widening only — no row is read, altered or deleted. If some existing
 * row held a value outside the new list, PostgreSQL would refuse the constraint
 * and roll the whole thing back, so the failure mode is "nothing happened".
 *
 * Run (from the repo root):
 *
 *   vercel env pull .env.production.local --environment=production --yes
 *   node --env-file=.env.production.local scripts/manual/apply-proposal-actions-migration.mjs
 *
 * Then delete .env.production.local — it holds live credentials.
 *
 * Add --dry-run to inspect the current state and stop before writing anything.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FILENAME = "20260808_036_proposal_review_actions_realign.sql";
const CONSTRAINT = "proposal_review_event_action_check";

/**
 * The six the code can already write and the database rejects today. Printed
 * after the change as the actual point of it — the SLA reminders that would
 * throw the day they first fire.
 */
const PREVIOUSLY_REJECTED = [
  "sla_reminder",
  "sla_escalated",
  "sla_auto_sent",
  "sla_blocked_special",
  "sla_blocked_delivery",
  "noon_app_handoff_skipped",
];

const dryRun = process.argv.includes("--dry-run");

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error(
    "\nDATABASE_URL is not set.\n\n" +
      "  vercel env pull .env.production.local --environment=production --yes\n" +
      `  node --env-file=.env.production.local scripts/manual/${
        "apply-proposal-actions-migration.mjs"
      }\n`,
  );
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1/.test(url);
const sql = postgres(url, { ssl: isLocal ? false : "require", max: 1, prepare: false });

/** The CHECK expression as PostgreSQL currently stores it, or null. */
async function readConstraint() {
  const rows = await sql`
    SELECT pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conname = ${CONSTRAINT}
  `;
  return rows[0]?.def ?? null;
}

/** Every action value the constraint currently allows, sorted. */
function valuesIn(definition) {
  if (!definition) return [];
  return [...definition.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]).sort();
}

try {
  // Never echo the connection string — only where it points.
  const [{ host, db }] = await sql`SELECT inet_server_addr()::text AS host, current_database() AS db`
    .then((r) => (r.length ? r : [{ host: null, db: null }]));
  console.log(`\n· connected to database "${db ?? "?"}"${host ? ` at ${host}` : ""}`);

  const already = await sql`
    SELECT 1 FROM public.schema_migrations WHERE filename = ${FILENAME}
  `;
  if (already.length > 0) {
    console.log(`\n· ${FILENAME} is already recorded as applied. Nothing to do.`);
    process.exit(0);
  }

  const before = await readConstraint();
  const beforeValues = valuesIn(before);
  console.log(`\n  BEFORE — ${beforeValues.length} actions allowed`);
  console.log(`    missing that the code can write: ${
    PREVIOUSLY_REJECTED.filter((v) => !beforeValues.includes(v)).join(", ") || "(none)"
  }`);

  if (dryRun) {
    console.log("\n· --dry-run: stopping before any write.\n");
    process.exit(0);
  }

  // One batch, exactly as psql would run it — the file carries its own
  // BEGIN/COMMIT, so a failure anywhere leaves the database untouched.
  process.stdout.write(`\n· applying ${FILENAME} … `);
  await sql.unsafe(readFileSync(join(ROOT, "supabase", "migrations", FILENAME), "utf8"));
  console.log("ok");

  const afterValues = valuesIn(await readConstraint());
  const stillMissing = PREVIOUSLY_REJECTED.filter((v) => !afterValues.includes(v));
  console.log(`\n  AFTER  — ${afterValues.length} actions allowed`);
  console.log(`    added: ${afterValues.filter((v) => !beforeValues.includes(v)).join(", ") || "(none)"}`);

  if (stillMissing.length > 0) {
    console.error(`\n  STILL REJECTED: ${stillMissing.join(", ")} — the file did not do its job.\n`);
    process.exit(1);
  }
  console.log("\n· the SLA reminder path can now record what it does.\n");
} catch (error) {
  console.error(`\nFAILED: ${error.message}`);
  console.error("Nothing was changed — the migration runs inside a transaction.\n");
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
