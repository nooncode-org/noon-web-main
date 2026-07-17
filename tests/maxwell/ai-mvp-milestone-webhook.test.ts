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
 *  - B8 #4 email: fired once on a FIRST version-ready (right recipient/link),
 *    suppressed on dedup replays / other kinds / unmapped projects, and a
 *    sender crash never breaks the webhook's 2xx contract
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
  // B8 #4 resolution chain (project → workspace → session/proposal). Happy-path
  // defaults; individual tests override per-case.
  getClientWorkspaceByNoonAppProjectId: vi.fn(async () => ({
    id: "ws-1",
    studioSessionId: "sess-1",
    paymentStatus: "paid",
    workspaceStatus: "active",
    latestUpdateSummary: null,
    noonAppProjectId: "project-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
  getStudioSession: vi.fn(async () => ({
    id: "sess-1",
    goalSummary: "Ops dashboard",
    language: "en",
  })),
  getLatestProposalRequest: vi.fn(async () => ({
    id: "prop-1",
    deliveryRecipient: "client@example.com",
  })),
}));

vi.mock("@/lib/maxwell/lifecycle-emails", () => ({
  sendMvpReadyEmail: vi.fn(async () => ({
    provider: "resend",
    messageId: "msg-1",
  })),
  sendMvpEscalatedEmail: vi.fn(async () => ({
    provider: "resend",
    messageId: "msg-esc-1",
  })),
}));

import * as repos from "@/lib/maxwell/repositories";
import { sendMvpEscalatedEmail, sendMvpReadyEmail } from "@/lib/maxwell/lifecycle-emails";
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
  // B8 #4 builds the workspace link with the real buildWorkspaceUrl.
  vi.stubEnv("MAXWELL_PUBLIC_BASE_URL", "https://noon.example");
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

// ============================================================================
// B8 #4 — "first version ready" client email
// ============================================================================

const versionReadyPayload = {
  event: "ai_mvp_milestone",
  kind: "version-ready",
  project_id: "project-1",
  version_url: "https://preview.example/v1",
};

describe("AI MVP milestone webhook — B8 #4 mvp-ready email", () => {
  it("sends the email once on a FIRST version-ready, with the resolved recipient and links", async () => {
    const res = await POST(buildSignedRequest(versionReadyPayload));

    expect(res.status).toBe(200);
    expect(sendMvpReadyEmail).toHaveBeenCalledTimes(1);
    expect(sendMvpReadyEmail).toHaveBeenCalledWith({
      projectId: "project-1",
      to: "client@example.com",
      projectTitle: "Ops dashboard",
      workspaceUrl: "https://noon.example/en/maxwell/workspace/sess-1",
      previewUrl: "https://preview.example/v1",
    });
  });

  it("does NOT send on a dedup replay (created:false)", async () => {
    vi.mocked(repos.recordAiMvpMilestone).mockResolvedValueOnce({
      milestone: {
        id: "milestone-1",
        projectId: "project-1",
        kind: "version-ready",
        versionUrl: "https://preview.example/v1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      created: false,
    });

    const res = await POST(buildSignedRequest(versionReadyPayload));

    expect(res.status).toBe(200);
    expect(sendMvpReadyEmail).not.toHaveBeenCalled();
  });

  it("does NOT send for non-version-ready kinds", async () => {
    const res = await POST(buildSignedRequest(basePayload)); // kind: started

    expect(res.status).toBe(200);
    expect(sendMvpReadyEmail).not.toHaveBeenCalled();
  });

  it("skips (still 2xx) when no workspace is mapped to the project", async () => {
    vi.mocked(repos.getClientWorkspaceByNoonAppProjectId).mockResolvedValueOnce(null);

    const res = await POST(buildSignedRequest(versionReadyPayload));

    expect(res.status).toBe(200);
    expect(sendMvpReadyEmail).not.toHaveBeenCalled();
  });

  it("skips (still 2xx) when the proposal has no delivery recipient", async () => {
    vi.mocked(repos.getLatestProposalRequest).mockResolvedValueOnce(null as never);

    const res = await POST(buildSignedRequest(versionReadyPayload));

    expect(res.status).toBe(200);
    expect(sendMvpReadyEmail).not.toHaveBeenCalled();
  });

  it("never breaks the webhook 2xx when the email sender throws", async () => {
    vi.mocked(sendMvpReadyEmail).mockRejectedValueOnce(new Error("resend down"));

    const res = await POST(buildSignedRequest(versionReadyPayload));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.deduplicated).toBe(false);
  });
});

// ============================================================================
// Escalated — "a specialist is on your project" reassurance email
// ============================================================================

const escalatedPayload = {
  event: "ai_mvp_milestone",
  kind: "escalated",
  project_id: "project-1",
};

describe("AI MVP milestone webhook — escalated reassurance email", () => {
  it("sends once on a FIRST escalated, with the resolved recipient and workspace link", async () => {
    const res = await POST(buildSignedRequest(escalatedPayload));

    expect(res.status).toBe(200);
    expect(sendMvpEscalatedEmail).toHaveBeenCalledTimes(1);
    expect(sendMvpEscalatedEmail).toHaveBeenCalledWith({
      projectId: "project-1",
      to: "client@example.com",
      projectTitle: "Ops dashboard",
      workspaceUrl: "https://noon.example/en/maxwell/workspace/sess-1",
    });
    // The version-ready sender must NOT fire for an escalated milestone.
    expect(sendMvpReadyEmail).not.toHaveBeenCalled();
  });

  it("does NOT send on a dedup replay (created:false)", async () => {
    vi.mocked(repos.recordAiMvpMilestone).mockResolvedValueOnce({
      milestone: {
        id: "milestone-1",
        projectId: "project-1",
        kind: "escalated",
        versionUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      created: false,
    });

    const res = await POST(buildSignedRequest(escalatedPayload));

    expect(res.status).toBe(200);
    expect(sendMvpEscalatedEmail).not.toHaveBeenCalled();
  });

  it("does NOT send for non-escalated kinds", async () => {
    const res = await POST(buildSignedRequest(versionReadyPayload));

    expect(res.status).toBe(200);
    expect(sendMvpEscalatedEmail).not.toHaveBeenCalled();
  });

  it("skips (still 2xx) when no workspace is mapped to the project", async () => {
    vi.mocked(repos.getClientWorkspaceByNoonAppProjectId).mockResolvedValueOnce(null);

    const res = await POST(buildSignedRequest(escalatedPayload));

    expect(res.status).toBe(200);
    expect(sendMvpEscalatedEmail).not.toHaveBeenCalled();
  });

  it("never breaks the webhook 2xx when the escalated sender throws", async () => {
    vi.mocked(sendMvpEscalatedEmail).mockRejectedValueOnce(new Error("resend down"));

    const res = await POST(buildSignedRequest(escalatedPayload));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.deduplicated).toBe(false);
  });
});
