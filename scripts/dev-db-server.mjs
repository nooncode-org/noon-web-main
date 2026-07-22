#!/usr/bin/env node
/**
 * scripts/dev-db-server.mjs
 *
 * A real Postgres for local development, with nothing to install and no account
 * to create: PGlite is Postgres compiled to WebAssembly, run in-process and
 * exposed over TCP so the app connects exactly as it would to Supabase.
 *
 * This exists because the client portal only renders with a database behind it.
 * Without one it could only be verified in pieces — never clicked through.
 *
 * Usage:
 *   node scripts/dev-db-server.mjs            # 127.0.0.1:5432, persisted to .pglite/
 *   node scripts/dev-db-server.mjs --port 5433
 *   node scripts/dev-db-server.mjs --memory   # throwaway, nothing written to disk
 *
 * Then point DATABASE_URL at it (user/password/database are ignored — PGlite
 * serves a single database and does not authenticate):
 *   DATABASE_URL=postgresql://dev:dev@localhost:5432/dev
 *
 * DEVELOPMENT ONLY. Never point production at this.
 */

import fs from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { ensureSchema } from "./dev-db.lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
/**
 * The data lives under node_modules/.cache, NOT at the project root.
 *
 * Postgres data files are binary, and Tailwind's source scanner walks the
 * project tree: with the directory at the root it choked on those bytes
 * ("Invalid code point") and took the whole app down with a CSS error. Every
 * tool already ignores node_modules, and the data is disposable (recreate with
 * `npm run db:migrate && npm run db:seed`).
 */
const DATA_DIR = join(ROOT, "node_modules", ".cache", "noon-pglite");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const port = Number(arg("port", 5432));
const inMemory = process.argv.includes("--memory");

fs.mkdirSync(dirname(DATA_DIR), { recursive: true });
const db = await PGlite.create(inMemory ? undefined : DATA_DIR);

// Supabase ships roles that our migrations GRANT to. They don't exist in a bare
// Postgres, so create them up front — otherwise every migration that grants to
// service_role fails.
for (const role of ["service_role", "anon", "authenticated"]) {
  await db.exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
      CREATE ROLE ${role} NOLOGIN;
    END IF;
  END $$;`);
}

// Bring the schema up IN-PROCESS. Pushing the multi-hundred-KB baseline through
// the socket resets the connection; PGlite's own exec handles it fine.
const { total, ran } = await ensureSchema({
  root: join(__dirname, ".."),
  exec: (text) => db.exec(text),
  query: async (text) => (await db.query(text)).rows,
  log: (line) => console.log(line),
});
console.log(ran === 0 ? `· schema up to date (${total} migrations)` : `· applied ${ran} migration(s)`);

const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
await server.start();

const { rows } = await db.query("select version()");
console.log(`${String(rows[0].version).split(" on ")[0]}`);
console.log(`listening on 127.0.0.1:${port}${inMemory ? " (in-memory)" : ` (data: ${DATA_DIR})`}`);
console.log("press Ctrl+C to stop");

async function shutdown() {
  await server.stop();
  await db.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
