/**
 * scripts/manual/test-rest.js
 *
 * Manual sanity check: verify Supabase REST endpoint is reachable
 * with the configured anon key.
 * Run with: node --env-file=.env scripts/manual/test-rest.js
 *
 * Requires:
 *   SUPABASE_URL       (e.g. https://<project-ref>.supabase.co)
 *   SUPABASE_ANON_KEY  (the anon JWT from Supabase API settings)
 */

const supabaseUrl = process.env.SUPABASE_URL;
const apiKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !apiKey) {
  console.error("SUPABASE_URL and SUPABASE_ANON_KEY must be set. Aborting.");
  process.exit(1);
}

async function test() {
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/`, {
      headers: { apikey: apiKey },
    });
    console.log("Status:", res.status, res.statusText);
    const text = await res.text();
    console.log("Body:", text.substring(0, 200));
  } catch (err) {
    console.error("Fetch error:", err.message);
  }
}

test();
