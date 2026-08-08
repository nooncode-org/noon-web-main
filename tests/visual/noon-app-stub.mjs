/**
 * tests/visual/noon-app-stub.mjs
 *
 * A stand-in for the Noon App, so the parts of the portal that depend on it can
 * finally be opened by a test.
 *
 * WHY THIS EXISTS. Three of the portal's surfaces are gated on data this
 * repository never owns — it asks the App at render time and keeps nothing:
 *
 *   · the DOMAINS tab appears only when the App reports a published URL;
 *   · the VERSIONS tab only when the App returns versions;
 *   · the membership notices — the heads-up before it ends and the "your site
 *     is offline, nothing was deleted" after — only when the App says so.
 *
 * So none of them had ever been rendered by an automated check, and the third
 * is some of the most delicate copy a client ever reads. Seeding the local
 * database does not help: the gate is upstream of it.
 *
 * The stub answers the one endpoint the website calls, with a payload shaped by
 * `projectStatusEnvelopeSchema`. It does NOT verify our request signature —
 * that path has its own unit tests, and a stub that re-implements the thing
 * under test proves nothing.
 *
 * The scenario is chosen per project id, so one server covers every case:
 *   dev-demo-project            → live, published, versions, active membership
 *   dev-demo-project-ending     → cancelled, still inside the paid period
 *   dev-demo-project-ended      → membership over (the retention clock starts)
 */

import { createServer } from "node:http";

const PATH_PREFIX = "/api/integrations/website/project-status/";

/** Far enough out that the "ends on <date>" copy always has a future date. */
function inDays(days) {
  const at = new Date();
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString();
}

function baseData(projectId, membership) {
  const now = new Date().toISOString();
  return {
    project: { id: projectId, name: "Ops dashboard for field teams", status: "in_development" },
    proposal: {
      title: "Ops dashboard for field teams",
      amount: 4500,
      currency: "USD",
      paymentStatus: "paid",
    },
    payment: { activated: true, status: "confirmed" },
    membership,
    versions: [
      { sequence: 2, state: "published", previewUrl: "https://example.com/v2", at: now, published: true },
      { sequence: 1, state: "superseded", previewUrl: "https://example.com/v1", at: now, published: false },
    ],
    publishedSequence: 2,
    publishedUrl: "https://opsdash.example.com",
    latestUpdate: { kind: "status_changed", status: "in_development", at: now },
    serverTime: now,
  };
}

const SCENARIOS = {
  "dev-demo-project": () =>
    baseData("dev-demo-project", {
      status: "active",
      monthlyAmountUsd: 200,
      currentPeriodEnd: inDays(21),
    }),
  "dev-demo-project-ending": () =>
    baseData("dev-demo-project-ending", {
      status: "cancelled",
      monthlyAmountUsd: 200,
      currentPeriodEnd: inDays(9),
    }),
  "dev-demo-project-ended": () =>
    baseData("dev-demo-project-ended", {
      status: "ended",
      monthlyAmountUsd: 200,
      currentPeriodEnd: inDays(-3),
    }),
};

export function startNoonAppStub(port) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (!url.pathname.startsWith(PATH_PREFIX)) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { code: "NOT_FOUND" } }));
      return;
    }

    const projectId = decodeURIComponent(url.pathname.slice(PATH_PREFIX.length));
    const scenario = SCENARIOS[projectId];
    if (!scenario) {
      // Unknown project: answer the App's own shape for it, so the website
      // exercises its real "no App data" path rather than a transport error.
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { code: "PROJECT_NOT_FOUND" } }));
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: scenario(), requestId: `stub-${Date.now()}` }));
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
