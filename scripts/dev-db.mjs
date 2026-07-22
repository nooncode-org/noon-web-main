#!/usr/bin/env node
/**
 * scripts/dev-db.mjs
 *
 * Stands up a WORKING client portal on a development database, so the portal can
 * be exercised for real without waiting for a paying client to exist.
 *
 * Why this exists: the portal's page only renders with a database behind it.
 * Until now it was verified in pieces (a mock page, unit tests) because there was
 * nowhere to run the real thing. Point DATABASE_URL at a scratch Supabase/Postgres
 * project and this applies the schema and seeds a demo client end to end.
 *
 * Commands:
 *   node scripts/dev-db.mjs migrate   apply every pending migration (no psql needed)
 *   node scripts/dev-db.mjs seed      create/refresh the demo client + workspace
 *   node scripts/dev-db.mjs status    what's applied, what's seeded
 *   node scripts/dev-db.mjs unseed    remove ONLY the demo rows
 *
 * Safety: every command refuses to touch a database that holds data it did not
 * create, unless --force is passed. Demo rows all carry the `dev-demo` prefix, so
 * `unseed` can never reach real client data.
 *
 * Env: reads .env.local / .env (never prints secrets — only the host).
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const DEMO_PREFIX = "dev-demo";
const DEMO_SESSION = `${DEMO_PREFIX}-session`;
const DEMO_WORKSPACE = `${DEMO_PREFIX}-workspace`;
const DEMO_PROPOSAL = `${DEMO_PREFIX}-proposal`;

/** Load .env.local / .env into process.env WITHOUT echoing any value. */
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const eq = line.indexOf("=");
      if (eq < 1 || line.trimStart().startsWith("#")) continue;
      const key = line.slice(0, eq).trim();
      if (!/^[A-Z0-9_]+$/.test(key) || process.env[key]) continue;
      process.env[key] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
}

function connect() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error(
      "DATABASE_URL is not set. Put your development database URL in .env.local first.",
    );
    process.exit(1);
  }
  const host = url.match(/@([^:/?]+)/)?.[1] ?? "unknown";
  const local = /^(localhost|127\.0\.0\.1|::1)$/.test(host);
  console.log(`· database host: ${host}`);
  return {
    sql: postgres(url, { ssl: local ? false : "require", max: 1, prepare: false }),
    host,
  };
}

const nowIso = () => new Date().toISOString();

/**
 * Guard: refuse to write to a database that already holds sessions this script
 * did not create. A scratch database has none; production has plenty.
 */
async function assertScratch(sql, force) {
  // A brand-new database has no tables at all — that is the emptiest a scratch
  // DB gets, so treat the missing relation as "nothing here to protect".
  const exists = await sql`SELECT to_regclass('public.studio_session') AS t`;
  if (!exists[0].t) return 0;

  const [{ n }] = await sql`
    SELECT count(*)::int AS n FROM studio_session WHERE id NOT LIKE ${DEMO_PREFIX + "%"}
  `;
  if (n > 0 && !force) {
    console.error(
      `\nRefusing to continue: this database already holds ${n} session(s) that are not demo data.\n` +
        "This command is meant for a scratch development database. Pass --force only if you are certain.",
    );
    process.exit(1);
  }
  return n;
}

function localMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** The ledger keys migrations by `filename`; it may not exist yet. */
async function appliedMigrations(sql) {
  const exists = await sql`SELECT to_regclass('public.schema_migrations') AS t`;
  if (!exists[0].t) return new Set();
  const rows = await sql`SELECT filename FROM public.schema_migrations`;
  return new Set(rows.map((r) => r.filename));
}

async function migrate(sql) {
  // `supabase/schema.sql` is the greenfield baseline and the migrations assume
  // it: the very first one is a preflight that SELECTs from tables it never
  // creates. On an empty database, lay the baseline down first.
  const baseline = await sql`SELECT to_regclass('public.studio_session') AS t`;
  if (!baseline[0].t) {
    process.stdout.write("  applying supabase/schema.sql (baseline) … ");
    await sql.unsafe(readFileSync(join(ROOT, "supabase", "schema.sql"), "utf8"));
    console.log("ok");
  }

  const files = localMigrations();
  const applied = await appliedMigrations(sql);
  console.log(`· ${files.length} migration files on disk, ${applied.size} already recorded`);

  let ran = 0;
  let skipped = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    process.stdout.write(`  applying ${file} … `);
    const body = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    try {
      // Each file runs as ONE multi-statement batch so the transactions inside
      // it behave exactly as they do under psql.
      await sql.unsafe(body);
    } catch (error) {
      console.log("FAILED");
      console.error(`\n${file}: ${error.message}\n`);
      process.exit(1);
    }

    // Only ~2/3 of the files self-register. Record the rest so a second run is
    // a no-op instead of replaying them.
    const nowApplied = await appliedMigrations(sql);
    if (!nowApplied.has(file)) {
      const ledger = await sql`SELECT to_regclass('public.schema_migrations') AS t`;
      if (ledger[0].t) {
        await sql`
          INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by)
          VALUES (${file}, now(), NULL, 'dev-db:runner')
          ON CONFLICT (filename) DO NOTHING
        `;
      } else {
        skipped += 1; // pre-ledger files (they run before it exists)
      }
    }
    ran += 1;
    console.log("ok");
  }

  console.log(ran === 0 ? "· already up to date" : `· applied ${ran} migration(s)`);
  if (skipped > 0) console.log(`  (${skipped} ran before the ledger existed and will re-run)`);
}

async function seed(sql) {
  const at = nowIso();
  // Stagger the thread rows: identical timestamps leave their order ambiguous,
  // which reads like a merge bug when it's really just the fixture.
  const minutesAgo = (n) => new Date(Date.now() - n * 60_000).toISOString();
  const email = (process.env.DEV_VIEWER_EMAIL || "dev@noon.dev").trim().toLowerCase();

  await sql`
    INSERT INTO studio_session (
      id, initial_prompt, status, owner_email, owner_name, goal_summary,
      language, created_at, updated_at
    ) VALUES (
      ${DEMO_SESSION}, 'Build an ops dashboard for field teams', 'converted',
      ${email}, 'Demo Client', 'Ops dashboard for field teams', 'en', ${at}, ${at}
    )
    ON CONFLICT (id) DO UPDATE SET owner_email = EXCLUDED.owner_email, updated_at = EXCLUDED.updated_at
  `;

  await sql`
    INSERT INTO proposal_request (
      id, studio_session_id, public_token, status, review_required,
      approved_amount_usd, approved_currency, payment_modality, monthly_amount_usd,
      review_notified_at, sent_at, stripe_paid_at, created_at, updated_at
    ) VALUES (
      ${DEMO_PROPOSAL}, ${DEMO_SESSION}, ${DEMO_PREFIX + "-token"}, 'paid', false,
      4500, 'USD', 'membership', 200, ${at}, ${at}, ${at}, ${at}, ${at}
    )
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
  `;

  await sql`
    INSERT INTO client_workspace (
      id, studio_session_id, payment_status, workspace_status,
      latest_update_summary, noon_app_project_id, created_at, updated_at
    ) VALUES (
      ${DEMO_WORKSPACE}, ${DEMO_SESSION}, 'confirmed', 'in_development',
      'v2 shipped — dashboards and role-based access are live.',
      ${DEMO_PREFIX + "-project"}, ${at}, ${at}
    )
    ON CONFLICT (id) DO UPDATE SET
      workspace_status = EXCLUDED.workspace_status,
      noon_app_project_id = EXCLUDED.noon_app_project_id,
      updated_at = EXCLUDED.updated_at
  `;

  // A thread with something already in it, so the merged chat has real rows to
  // order (a team update + a client message + a tracked request).
  await sql`
    INSERT INTO workspace_update (
      id, client_workspace_id, title, content, update_type, is_client_visible,
      created_by, created_at
    ) VALUES (
      ${DEMO_PREFIX + "-update-1"}, ${DEMO_WORKSPACE},
      'Version 2 is live', 'Dashboards and role-based access shipped.',
      'status_update', true, 'noon-team', ${minutesAgo(90)}
    )
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO client_comment (id, client_workspace_id, body, external_comment_id, created_at)
    VALUES (
      ${DEMO_PREFIX + "-comment-1"}, ${DEMO_WORKSPACE},
      'Looks great — can the header logo be a bit bigger?', ${DEMO_PREFIX + "-comment-1"}, ${minutesAgo(45)}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  console.log(`· seeded demo project for ${email}`);
  console.log(`\n  Open:  http://localhost:3211/en/maxwell/workspace/${DEMO_SESSION}\n`);
}

async function unseed(sql) {
  // ON DELETE CASCADE from studio_session clears the workspace + its children.
  const rows = await sql`DELETE FROM studio_session WHERE id LIKE ${DEMO_PREFIX + "%"} RETURNING id`;
  console.log(`· removed ${rows.length} demo session(s)`);
}

async function status(sql) {
  const applied = await appliedMigrations(sql);
  const files = localMigrations();
  // The ledger keys by the full filename, extension included.
  const pending = files.filter((f) => !applied.has(f));
  console.log(`· migrations: ${files.length - pending.length}/${files.length} applied`);
  if (pending.length) console.log(`  pending: ${pending.slice(0, 5).join(", ")}${pending.length > 5 ? " …" : ""}`);

  const [{ n: demo }] = await sql`
    SELECT count(*)::int AS n FROM studio_session WHERE id LIKE ${DEMO_PREFIX + "%"}
  `;
  const [{ n: other }] = await sql`
    SELECT count(*)::int AS n FROM studio_session WHERE id NOT LIKE ${DEMO_PREFIX + "%"}
  `;
  console.log(`· sessions: ${demo} demo, ${other} other`);
  if (demo > 0) {
    console.log(`\n  Open:  http://localhost:3211/en/maxwell/workspace/${DEMO_SESSION}\n`);
  }
}

async function main() {
  loadEnv();
  const command = process.argv[2];
  const force = process.argv.includes("--force");
  const commands = { migrate, seed, unseed, status };
  if (!commands[command]) {
    console.error("Usage: node scripts/dev-db.mjs <migrate|seed|unseed|status> [--force]");
    process.exit(1);
  }

  const { sql } = connect();
  try {
    if (command !== "status") await assertScratch(sql, force);
    await commands[command](sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  // postgres.js leaves `.message` empty on connection failures, which would
  // otherwise print a blank line and look like nothing happened.
  const detail = error?.message || error?.code || String(error);
  const hint =
    error?.code === "ECONNREFUSED"
      ? "\nNothing is listening at that address. Check DATABASE_URL in .env.local."
      : error?.code === "ENOTFOUND"
        ? "\nThat host doesn't resolve. Check DATABASE_URL in .env.local."
        : error?.code === "CONNECT_TIMEOUT"
          ? "\nThe database didn't answer in time (paused project? wrong port?)."
          : "";
  console.error(`\nFailed: ${detail}${hint}`);
  process.exit(1);
});
