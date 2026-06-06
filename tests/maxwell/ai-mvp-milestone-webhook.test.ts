/**
 * tests/maxwell/ai-mvp-milestone-webhook.test.ts
 *
 * End-to-end tests for the inbound AI MVP pipeline milestone receiver
 * (`POST /api/integrations/noon-app/ai-mvp-milestone`).
 *
 * The repository (`recordAiMvpMilestone`) is mocked. The HMAC signature
 * verification, Zod schema parsing and route handler run for real, so the
 * security envelope is exercised identically to the proposal-review-decision
 * receiver it mirrors.
 *
 * Coverage matrix:
 *  - Signature: missing / invalid / wrong-secret / outside skew / non-numeric ts
 *               / tampered body / missing timestamp header (F-1 mirror)
 *  - Payload: malformed JSON / Zod failure / wrong event literal / unknown kind
 *             / malformed version_url
 *  - Kinds: started / version-ready (+url) / escalated persisted with the right args
 *  - version_url: honoured only on version-ready; ignored on other kinds
 *  - Idempotency: dedup replay returns 2xx and surfaces deduplicated:true
 */

import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/maxwell/repositories", () => ({
  recordAiMvpMilestone: vi.fn(
    async (input: {
      projectId: string;
      kind: string;
      versionUrl?: string | null;
    }) => ({
      milestone: {
        id: "milestone-1",
        projectId: input.projectId,
        kind: input.kind,
        versionUrl: input.versionUrl ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      created: true,
    }),
  ),
}));

import * as repos from "@/lib/maxwell/repositories";
import { POST } from "@/app/api/integrations/noon-app/ai-mvp-milestone/route";

const TEST_SECRET = "test-secret-not-for-prod";
const ROUTE_URL =
  "http://localhost/api/integrations/noon-app/ai-mvp-milestone";

const basePayload = {
  event: "ai_mvp_milestone",
  kind: "started",
  project_id: "project-1",
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
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ============================================================================
// Signature verification
// ============================================================================

describe("AI MVP milestone webhook — signature verification", () => {
  it("returns 401 when the signature header is missing", async () => {
    const req = buildSignedRequest(basePayload, { omitSignature: true });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(repos.recordAiMvpMilestone).not.toHaveBeenCalled();
  });

  it("returns 401 when the signature does not match the body", async () => {
    const req = buildSignedRequest(basePayload, {
      signature: `sha256=${"0".repeat(64)}`,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signed with a different secret (forged signature)", async () => {
    const req = buildSignedRequest(basePayload, { secret: "wrong-secret" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the timestamp is outside the 5-minute window", async () => {
    const req = buildSignedRequest(basePayload, {
      timestamp: Math.floor(Date.now() / 1000) - 6 * 60,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the timestamp is not numeric", async () => {
    const bodyText = JSON.stringify(basePayload);
    const validTs = Math.floor(Date.now() / 1000);
    const sig = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${validTs}.${bodyText}`)
      .digest("hex");

    const headers = new Headers({
      "content-type": "application/json",
      "x-noon-signature": `sha256=${sig}`,
      "x-noon-timestamp": "not-a-number",
    });
    const req = new Request(ROUTE_URL, { method: "POST", headers, body: bodyText });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the body is altered after signing (tamper)", async () => {
    const originalBody = JSON.stringify(basePayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${timestamp}.${originalBody}`)
      .digest("hex");

    const tamperedBody = originalBody.replace("project-1", "project-evil");

    const headers = new Headers({
      "content-type": "application/json",
      "x-noon-signature": `sha256=${sig}`,
      "x-noon-timestamp": String(timestamp),
    });
    const req = new Request(ROUTE_URL, { method: "POST", headers, body: tamperedBody });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("F-1 regression: returns 401 when x-noon-timestamp header is missing", async () => {
    const req = buildSignedRequest(basePayload, { omitTimestamp: true });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.message).toBe("Missing Noon App timestamp.");
  });
});

// ============================================================================
// Payload validation
// ============================================================================

describe("AI MVP milestone webhook — payload validation", () => {
  it("returns 400 when the JSON is malformed", async () => {
    const bodyText = "{ not valid json";
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${timestamp}.${bodyText}`)
      .digest("hex");

    const headers = new Headers({
      "content-type": "application/json",
      "x-noon-signature": `sha256=${sig}`,
      "x-noon-timestamp": String(timestamp),
    });
    const req = new Request(ROUTE_URL, { method: "POST", headers, body: bodyText });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing (Zod failure)", async () => {
    const req = buildSignedRequest({ event: "ai_mvp_milestone" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(repos.recordAiMvpMilestone).not.toHaveBeenCalled();
  });

  it("returns 400 when the event literal is wrong", async () => {
    const req = buildSignedRequest({ ...basePayload, event: "something_else" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 on an unknown kind", async () => {
    const req = buildSignedRequest({ ...basePayload, kind: "totally-fake" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when version_url is not a valid URL", async () => {
    const req = buildSignedRequest({
      event: "ai_mvp_milestone",
      kind: "version-ready",
      project_id: "project-1",
      version_url: "not-a-url",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// Persistence per kind
// ============================================================================

describe("AI MVP milestone webhook — persistence", () => {
  it("records a 'started' milestone with no version_url", async () => {
    const req = buildSignedRequest(basePayload);
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(repos.recordAiMvpMilestone).toHaveBeenCalledWith({
      projectId: "project-1",
      kind: "started",
      versionUrl: null,
    });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.deduplicated).toBe(false);
  });

  it("records a 'version-ready' milestone WITH the version_url", async () => {
    const req = buildSignedRequest({
      event: "ai_mvp_milestone",
      kind: "version-ready",
      project_id: "project-1",
      version_url: "https://preview.example/v1",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(repos.recordAiMvpMilestone).toHaveBeenCalledWith({
      projectId: "project-1",
      kind: "version-ready",
      versionUrl: "https://preview.example/v1",
    });
  });

  it("records a 'version-ready' milestone with null url when App omits it", async () => {
    const req = buildSignedRequest({
      event: "ai_mvp_milestone",
      kind: "version-ready",
      project_id: "project-1",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(repos.recordAiMvpMilestone).toHaveBeenCalledWith({
      projectId: "project-1",
      kind: "version-ready",
      versionUrl: null,
    });
  });

  it("records an 'escalated' milestone", async () => {
    const req = buildSignedRequest({ ...basePayload, kind: "escalated" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(repos.recordAiMvpMilestone).toHaveBeenCalledWith({
      projectId: "project-1",
      kind: "escalated",
      versionUrl: null,
    });
  });

  it("ignores a stray version_url on a non-version-ready kind (never persists it)", async () => {
    const req = buildSignedRequest({
      event: "ai_mvp_milestone",
      kind: "started",
      project_id: "project-1",
      version_url: "https://preview.example/should-be-ignored",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(repos.recordAiMvpMilestone).toHaveBeenCalledWith({
      projectId: "project-1",
      kind: "started",
      versionUrl: null,
    });
  });
});

// ============================================================================
// Idempotency (durable-queue retries)
// ============================================================================

describe("AI MVP milestone webhook — idempotency", () => {
  it("returns 2xx and deduplicated:true when the repo reports a replay", async () => {
    vi.mocked(repos.recordAiMvpMilestone).mockResolvedValueOnce({
      milestone: {
        id: "milestone-1",
        projectId: "project-1",
        kind: "started",
        versionUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      created: false,
    });

    const req = buildSignedRequest(basePayload);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.deduplicated).toBe(true);
    expect(body.message).toMatch(/already recorded/i);
  });

  it("returns 500 when the repository throws", async () => {
    vi.mocked(repos.recordAiMvpMilestone).mockRejectedValueOnce(
      new Error("db exploded"),
    );

    const req = buildSignedRequest(basePayload);
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
