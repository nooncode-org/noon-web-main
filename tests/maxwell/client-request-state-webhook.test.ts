/**
 * tests/maxwell/client-request-state-webhook.test.ts
 *
 * End-to-end tests for the §9 client-request client-visible STATE receiver
 * (`POST /api/integrations/noon-app/client-request-state`, Slice B).
 *
 * The repository (`applyClientRequestState`) is mocked; the HMAC verification,
 * the §8.3 `assertNoInternalFields` tripwire, the `.strict()` allowlist parse and
 * the route handler all run for real, so the security envelope + monotonicity
 * mapping are exercised exactly as in production.
 *
 * Coverage:
 *  - Signature: missing / wrong-secret / outside skew / missing timestamp (F-1)
 *  - Payload: malformed JSON / missing fields / non-client-safe state / bad
 *             revision / UNKNOWN key rejected (strict allowlist) / internal field
 *             rejected (tripwire)
 *  - Monotonicity mapping: applied -> 200 applied:true, stale -> 200 applied:false,
 *             not_found -> 404, repo throws -> 500
 */

import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/maxwell/repositories", () => ({
  applyClientRequestState: vi.fn(async () => "applied"),
}));

import * as repos from "@/lib/maxwell/repositories";
import { POST } from "@/app/api/integrations/noon-app/client-request-state/route";

const TEST_SECRET = "test-secret-not-for-prod";
const ROUTE_URL = "http://localhost/api/integrations/noon-app/client-request-state";

const basePayload = {
  externalRequestId: "rq-1",
  clientVisibleState: "in_progress",
  revision: 2,
  at: "2026-06-17T12:00:00.000Z",
};

function buildSignedRequest(
  body: unknown,
  opts: {
    secret?: string;
    timestamp?: number;
    signature?: string;
    omitSignature?: boolean;
    omitTimestamp?: boolean;
    bodyOverride?: string;
  } = {},
): Request {
  const bodyText = opts.bodyOverride ?? JSON.stringify(body);
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const secret = opts.secret ?? TEST_SECRET;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${bodyText}`)
    .digest("hex");
  const signature = opts.signature ?? `sha256=${computed}`;

  const headers = new Headers({ "content-type": "application/json" });
  if (!opts.omitSignature) headers.set("x-noon-signature", signature);
  if (!opts.omitTimestamp) headers.set("x-noon-timestamp", String(timestamp));

  return new Request(ROUTE_URL, { method: "POST", headers, body: bodyText });
}

beforeEach(() => {
  vi.stubEnv("NOON_WEBSITE_WEBHOOK_SECRET", TEST_SECRET);
  vi.clearAllMocks();
  vi.mocked(repos.applyClientRequestState).mockResolvedValue("applied");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("client-request-state receiver — signature verification", () => {
  it("returns 401 when the signature header is missing", async () => {
    const res = await POST(buildSignedRequest(basePayload, { omitSignature: true }));
    expect(res.status).toBe(401);
    expect(repos.applyClientRequestState).not.toHaveBeenCalled();
  });

  it("returns 401 when signed with a different secret", async () => {
    const res = await POST(buildSignedRequest(basePayload, { secret: "wrong-secret" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the timestamp is outside the 5-minute window", async () => {
    const res = await POST(
      buildSignedRequest(basePayload, { timestamp: Math.floor(Date.now() / 1000) - 6 * 60 }),
    );
    expect(res.status).toBe(401);
  });

  it("F-1 regression: returns 401 when x-noon-timestamp header is missing", async () => {
    const res = await POST(buildSignedRequest(basePayload, { omitTimestamp: true }));
    expect(res.status).toBe(401);
  });
});

describe("client-request-state receiver — payload validation", () => {
  it("returns 400 when the JSON is malformed", async () => {
    const res = await POST(buildSignedRequest(null, { bodyOverride: "{ not json" }));
    expect(res.status).toBe(400);
    expect(repos.applyClientRequestState).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(buildSignedRequest({ externalRequestId: "rq-1" }));
    expect(res.status).toBe(400);
    expect(repos.applyClientRequestState).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-client-safe state (operational state cannot cross)", async () => {
    const res = await POST(buildSignedRequest({ ...basePayload, clientVisibleState: "escalated" }));
    expect(res.status).toBe(400);
    expect(repos.applyClientRequestState).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-positive / non-integer revision", async () => {
    expect((await POST(buildSignedRequest({ ...basePayload, revision: 0 }))).status).toBe(400);
    expect((await POST(buildSignedRequest({ ...basePayload, revision: -1 }))).status).toBe(400);
    expect((await POST(buildSignedRequest({ ...basePayload, revision: 1.5 }))).status).toBe(400);
  });

  it("rejects an UNKNOWN extra key (strict allowlist) with 400", async () => {
    const res = await POST(buildSignedRequest({ ...basePayload, operationalPriority: "p1" }));
    expect(res.status).toBe(400);
    expect(repos.applyClientRequestState).not.toHaveBeenCalled();
  });

  it("rejects a known internal field (assertNoInternalFields tripwire) with 400", async () => {
    const res = await POST(buildSignedRequest({ ...basePayload, reviewerId: "staff-1" }));
    expect(res.status).toBe(400);
    expect(repos.applyClientRequestState).not.toHaveBeenCalled();
  });
});

describe("client-request-state receiver — monotonicity mapping", () => {
  it("applies the state and returns 200 applied:true with the right repo args", async () => {
    vi.mocked(repos.applyClientRequestState).mockResolvedValue("applied");
    const res = await POST(buildSignedRequest(basePayload));

    expect(res.status).toBe(200);
    expect(repos.applyClientRequestState).toHaveBeenCalledWith("rq-1", {
      clientVisibleState: "in_progress",
      revision: 2,
      at: "2026-06-17T12:00:00.000Z",
    });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.applied).toBe(true);
  });

  it("returns 200 applied:false on a stale revision (idempotent no-op)", async () => {
    vi.mocked(repos.applyClientRequestState).mockResolvedValue("stale");
    const res = await POST(buildSignedRequest(basePayload));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.applied).toBe(false);
  });

  it("returns a non-revealing 404 when the request is unknown", async () => {
    vi.mocked(repos.applyClientRequestState).mockResolvedValue("not_found");
    const res = await POST(buildSignedRequest(basePayload));
    expect(res.status).toBe(404);
  });

  it("returns 500 when the repository throws", async () => {
    vi.mocked(repos.applyClientRequestState).mockRejectedValueOnce(new Error("db exploded"));
    const res = await POST(buildSignedRequest(basePayload));
    expect(res.status).toBe(500);
  });
});
