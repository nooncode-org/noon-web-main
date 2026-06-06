/**
 * tests/maxwell/prototipo-share.test.ts
 *
 * Coverage for the D-upstream wire helper (`requestPrototipoShare`) and the
 * pure UX state mapper (`mapShareResultToUxState`). HTTP plumbing is exercised
 * by mocking `global.fetch`, mirroring `prototipo-decision.test.ts`.
 *
 * Out of scope here:
 *   - The Server Action wrapping (`share-prototype.ts`) — exercised in the
 *     route-level smoke when bilateral testing arrives.
 *   - End-to-end UI rendering — covered by `tests/visual/studio-share-cta.spec.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestPrototipoShare } from "@/lib/maxwell/prototipo-share";
import {
  PROTOTIPO_SHARE_ERROR_CODES,
  mapShareResultToUxState,
  type PrototipoShareErrorCode,
  type RequestPrototipoShareResult,
} from "@/lib/maxwell/prototipo-share-types";

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

function jsonResponse(status: number, body: object | string): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { "content-type": "application/json" },
  });
}

function happyData(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: {
      idempotent: false,
      share_token: "share-tok-abc",
      prototype_workspace_id: "ws-uuid-1",
      lead_id: "lead-uuid-1",
      version_number: 1,
      issued_at: "2026-05-27T12:00:00Z",
      superseded_workspace_ids: [],
      ...overrides,
    },
    requestId: "req-123",
  };
}

const happyInput = {
  externalSessionId: "session-uuid-1",
  lead: {
    businessName: "Acme Inc.",
    projectTypeLabel: "Landing Page",
  },
  prototype: {
    v0ChatId: "chat-abc",
    versionNumber: 1,
    deployedUrl: "https://v0.dev/preview/abc",
    generatedAt: "2026-05-27T11:55:00Z",
  },
};

beforeEach(() => {
  process.env.NOON_WEBSITE_WEBHOOK_SECRET = "test-secret";
  process.env.NOON_APP_BASE_URL = "https://noon-app.test";
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("requestPrototipoShare — happy paths", () => {
  it("returns ok + isReplay=false on first successful POST", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(201, happyData()));

    const result = await requestPrototipoShare(happyInput);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.share_token).toBe("share-tok-abc");
      expect(result.data.prototype_workspace_id).toBe("ws-uuid-1");
      expect(result.data.lead_id).toBe("lead-uuid-1");
      expect(result.isReplay).toBe(false);
      expect(result.requestId).toBe("req-123");
    }
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns ok + isReplay=true on idempotent replay (200)", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, happyData({ idempotent: true })));

    const result = await requestPrototipoShare(happyInput);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.isReplay).toBe(true);
    }
  });

  it("preserves the superseded_workspace_ids array on regenerate", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        201,
        happyData({
          superseded_workspace_ids: ["ws-uuid-0", "ws-uuid-prev"],
          version_number: 2,
        }),
      ),
    );

    const result = await requestPrototipoShare({
      ...happyInput,
      prototype: { ...happyInput.prototype, versionNumber: 2 },
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.superseded_workspace_ids).toEqual(["ws-uuid-0", "ws-uuid-prev"]);
      expect(result.data.version_number).toBe(2);
    }
  });

  it("treats a 200 with malformed body as a fatal-unknown", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: { share_token: "missing-fields" } }));

    const result = await requestPrototipoShare(happyInput);

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_SHARE_ERROR_CODES.UNKNOWN);
      expect(result.httpStatus).toBe(200);
    }
  });

  it("includes lead.customer only when fields are present in the input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, happyData()));
    global.fetch = fetchMock;

    await requestPrototipoShare({
      ...happyInput,
      lead: {
        ...happyInput.lead,
        customer: { email: "client@example.com" },
      },
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.lead.customer).toEqual({ email: "client@example.com" });
    expect(body.lead.business_name).toBe("Acme Inc.");
    expect(body.prototype.v0_chat_id).toBe("chat-abc");
  });

  it("omits customer entirely when input.lead.customer is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, happyData()));
    global.fetch = fetchMock;

    await requestPrototipoShare(happyInput);

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.lead).not.toHaveProperty("customer");
  });

  it("includes prototype.generated_html when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, happyData()));
    global.fetch = fetchMock;

    await requestPrototipoShare({
      ...happyInput,
      prototype: {
        ...happyInput.prototype,
        generatedHtml: "// === file: app/page.tsx ===\nexport default () => null;",
      },
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.prototype.generated_html).toBe(
      "// === file: app/page.tsx ===\nexport default () => null;",
    );
  });

  it("omits prototype.generated_html when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, happyData()));
    global.fetch = fetchMock;

    await requestPrototipoShare(happyInput);

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.prototype).not.toHaveProperty("generated_html");
  });
});

describe("requestPrototipoShare — error code mapping", () => {
  it.each<[number, PrototipoShareErrorCode]>([
    [400, PROTOTIPO_SHARE_ERROR_CODES.INVALID_PROTOTYPE],
    [400, PROTOTIPO_SHARE_ERROR_CODES.INVALID_LEAD],
    [409, PROTOTIPO_SHARE_ERROR_CODES.WORKSPACE_TERMINAL],
    [500, PROTOTIPO_SHARE_ERROR_CODES.PERSIST_FAILED],
    [500, PROTOTIPO_SHARE_ERROR_CODES.TOKEN_GENERATION_FAILED],
  ])("maps HTTP %i with code %s to the structured error result", async (status, code) => {
    global.fetch = vi
      .fn()
      .mockImplementation(async () =>
        jsonResponse(status, { error: "X", code, requestId: "req-err" }),
      );

    const promise = requestPrototipoShare(happyInput);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(code);
      expect(result.httpStatus).toBe(status);
      expect(result.requestId).toBe("req-err");
    }
  });

  it("falls back to AUTH_FAILED for 401 without a structured code", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(async () => jsonResponse(401, "unauthorized"));

    const promise = requestPrototipoShare(happyInput);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_SHARE_ERROR_CODES.AUTH_FAILED);
    }
  });

  it("falls back to RATE_LIMITED for 429 without a structured code", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(async () => jsonResponse(429, "too many"));

    const promise = requestPrototipoShare(happyInput);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_SHARE_ERROR_CODES.RATE_LIMITED);
    }
  });

  it("classifies unknown 4xx as UNKNOWN preserving body.error", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(async () => jsonResponse(418, { error: "I'm a teapot" }));

    const promise = requestPrototipoShare(happyInput);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_SHARE_ERROR_CODES.UNKNOWN);
      expect(result.message).toBe("I'm a teapot");
    }
  });

  it("treats a network error as PERSIST_FAILED with httpStatus 0", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const promise = requestPrototipoShare(happyInput);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_SHARE_ERROR_CODES.PERSIST_FAILED);
      expect(result.httpStatus).toBe(0);
    }
  });
});

describe("mapShareResultToUxState", () => {
  it("maps ok → success with shareUrl + token + workspace id + isReplay echoed", () => {
    const result: RequestPrototipoShareResult = {
      status: "ok",
      data: {
        idempotent: false,
        share_token: "tok-xyz",
        prototype_workspace_id: "ws-99",
        lead_id: "lead-99",
        version_number: 1,
        issued_at: "2026-05-27T12:00:00Z",
        superseded_workspace_ids: [],
      },
      requestId: "req-1",
      isReplay: false,
    };

    expect(mapShareResultToUxState(result, "https://example/maxwell/prototipo/tok-xyz")).toEqual({
      kind: "success",
      shareUrl: "https://example/maxwell/prototipo/tok-xyz",
      shareToken: "tok-xyz",
      prototypeWorkspaceId: "ws-99",
      isReplay: false,
    });
  });

  it.each<[PrototipoShareErrorCode, string]>([
    [PROTOTIPO_SHARE_ERROR_CODES.WORKSPACE_TERMINAL, "terminal.workspace-locked"],
    [PROTOTIPO_SHARE_ERROR_CODES.PERSIST_FAILED, "transient.persist-failed"],
    [PROTOTIPO_SHARE_ERROR_CODES.TOKEN_GENERATION_FAILED, "transient.persist-failed"],
    [PROTOTIPO_SHARE_ERROR_CODES.RATE_LIMITED, "transient.rate-limited"],
    [PROTOTIPO_SHARE_ERROR_CODES.INVALID_PROTOTYPE, "fatal.unknown"],
    [PROTOTIPO_SHARE_ERROR_CODES.INVALID_LEAD, "fatal.unknown"],
    [PROTOTIPO_SHARE_ERROR_CODES.AUTH_FAILED, "fatal.unknown"],
    [PROTOTIPO_SHARE_ERROR_CODES.UNKNOWN, "fatal.unknown"],
  ])("maps error code %s to UX state %s", (code, kind) => {
    const result: RequestPrototipoShareResult = {
      status: "error",
      code,
      httpStatus: 400,
      message: "test",
    };
    expect(mapShareResultToUxState(result, "").kind).toBe(kind);
  });
});
