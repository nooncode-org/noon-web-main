/**
 * scripts/manual/test-db.js
 *
 * Manual sanity check: verify postgres.js can connect to the configured DB.
 * Run with: node --env-file=.env scripts/manual/test-db.js
 */

const postgres = require("postgres");

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL (or POSTGRES_URL) is not set. Aborting.");
  process.exit(1);
}

async function test(connectionString) {
  console.log("Testing connection (sanitized):", connectionString.replace(/:[^:@/]+@/, ":****@"));
  const sql = postgres(connectionString, {
    ssl: "require",
    max: 1,
    connect_timeout: 5,
  });
  try {
    const res = await sql`SELECT 1 AS num`;
    console.log("Success!", res);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await sql.end();
  }
}

test(url).then(() => console.log("Done"));
