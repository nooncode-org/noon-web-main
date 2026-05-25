/**
 * scripts/manual/prototipo-decision-smoke.js
 *
 * Operator smoke check for the D-slice ADR-023 cross-repo flow. Exercises
 * both sides of the contract NoonWeb owns:
 *
 *   1. GET  /api/integrations/website/prototype-signed-read/[token]
 *      (Pull B.2, ADR-024 wire — render data)
 *   2. POST /api/integrations/website/prototype-decision
 *      (ADR-023 wire — accept/reject submission)
 *
 * Useful for:
 *   - Bilateral smoke when App ships either handler — confirms HMAC envelope
 *     interop without needing a full client browser flow.
 *   - Diagnosing rate-limit / auth / signature mismatches without spinning up
 *     the dev server.
 *
 * Run:
 *   node --env-file=.env scripts/manual/prototipo-decision-smoke.js \
 *     --token <share_token> [--decision accepted|rejected] [--workspace <uuid>] [--notes "..."]
 *
 * If `--decision` is omitted, only the GET is exercised. If `--workspace` is
 * omitted on a POST run, the value from the GET response is reused (so a
 * single invocation can round-trip both calls).
 */

const crypto = require("node:crypto");

function parseArgs(argv) {
  const args = { token: null, decision: null, workspace: null, notes: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--token") args.token = argv[++i];
    else if (arg === "--decision") args.decision = argv[++i];
    else if (arg === "--workspace") args.workspace = argv[++i];
    else if (arg === "--notes") args.notes = argv[++i];
  }
  return args;
}

function requireEnv(name) {
  const value = (process.env[name] || "").trim();
  if (!value) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

function signEnvelope(secret, bodyText) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${bodyText}`)
    .digest("hex");
  return {
    timestamp,
    headers: {
      "x-noon-timestamp": timestamp,
      "x-noon-signature": `sha256=${signature}`,
    },
  };
}

async function getSignedRead({ baseUrl, secret, token }) {
  const { headers } = signEnvelope(secret, "");
  const url = `${baseUrl.replace(/\/$/, "")}/api/integrations/website/prototype-signed-read/${encodeURIComponent(token)}`;
  console.log(`GET ${url}`);
  const response = await fetch(url, { method: "GET", headers });
  const text = await response.text();
  console.log(`  status: ${response.status}`);
  console.log(`  cache-control: ${response.headers.get("cache-control")}`);
  console.log(`  body: ${text}`);
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // tolerate non-JSON; caller will fall back
  }
  return { ok: response.ok, status: response.status, parsed };
}

async function postDecision({ baseUrl, secret, token, prototypeWorkspaceId, decision, notes }) {
  const body = JSON.stringify({
    token,
    prototype_workspace_id: prototypeWorkspaceId,
    decision,
    ...(notes ? { notes } : {}),
    client_user_agent: "noon-web/prototipo-decision-smoke",
  });
  const { headers: signed } = signEnvelope(secret, body);
  const url = `${baseUrl.replace(/\/$/, "")}/api/integrations/website/prototype-decision`;
  console.log(`POST ${url}`);
  console.log(`  body: ${body}`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...signed },
    body,
  });
  const text = await response.text();
  console.log(`  status: ${response.status}`);
  console.log(`  body: ${text}`);
  return { ok: response.ok, status: response.status };
}

async function main() {
  const { token, decision, workspace, notes } = parseArgs(process.argv);
  if (!token) {
    console.error("Usage: --token <share_token> [--decision accepted|rejected] [--workspace <uuid>] [--notes \"...\"]");
    process.exit(1);
  }
  if (decision && decision !== "accepted" && decision !== "rejected") {
    console.error("--decision must be 'accepted' or 'rejected'");
    process.exit(1);
  }

  const baseUrl = requireEnv("NOON_APP_BASE_URL");
  const secret = requireEnv("NOON_WEBSITE_WEBHOOK_SECRET");

  console.log("--- GET prototype-signed-read ---");
  const getResult = await getSignedRead({ baseUrl, secret, token });

  if (!decision) {
    console.log("\nNo --decision flag — skipping POST. Done.");
    return;
  }

  let workspaceId = workspace;
  if (!workspaceId) {
    workspaceId = getResult.parsed && getResult.parsed.data && getResult.parsed.data.workspace
      ? getResult.parsed.data.workspace.id
      : null;
    if (!workspaceId) {
      console.error("\nGET did not return data.workspace.id — pass --workspace explicitly.");
      process.exit(1);
    }
    console.log(`\nUsing workspace id from GET response: ${workspaceId}`);
  }

  console.log("\n--- POST prototype-decision ---");
  await postDecision({
    baseUrl,
    secret,
    token,
    prototypeWorkspaceId: workspaceId,
    decision,
    notes: notes || null,
  });

  console.log("\nDone.");
}

main().catch((error) => {
  console.error("\nSmoke script failed:", error);
  process.exit(1);
});
