/**
 * tests/maxwell/client-comment-integration.test.ts
 *
 * Coverage for the v3 client-portal comment write-back wire (Slice 1b):
 * `buildClientCommentPayload`, `extractNoonAppCommentId`, and
 * `sendClientCommentToNoonApp`. The send path is exercised by mocking
 * `global.fetch` (mirrors `noon-app-integration.test.ts`) so URL composition,
 * the camelCase body, and the retry policy can be asserted exactly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildClientCommentPayload,
  extractNoonAppCommentId,
  sendClientCommentToNoonApp,
} from "@/lib/noon-app-integration";

describe("buildClientCommentPayload", () => {
  it("builds the frozen camelCase shape with author=client", () => {
    const payload = buildClientCommentPayload({
      projectId: "proj-1",
      externalCommentId: "ext-1",
      body: "Looks great!",
      at: "2026-06-15T12:00:00.000Z",
    });
    expect(payload).toEqual({
      projectId: "proj-1",
      externalCommentId: "ext-1",
      author: "client",
      body: "Looks great!",
      at: "2026-06-15T12:00:00.000Z",
    });
  });

  it("defaults `at` to a valid ISO 8601 timestamp when omitted", () => {
    const payload = buildClientCommentPayload({
      projectId: "proj-1",
      externalCommentId: "ext-1",
      body: "Hi",
    });
    expect(payload.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  });
});

describe("extractNoonAppCommentId", () => {
  it("extracts a first-write reply", () => {
    expect(extractNoonAppCommentId({ idempotent: false, commentId: "c-1", requestId: "r" })).toEqual({
      commentId: "c-1",
      idempotent: false,
    });
  });

  it("extracts an idempotent replay reply", () => {
    expect(extractNoonAppCommentId({ idempotent: true, commentId: "c-1" })).toEqual({
      commentId: "c-1",
      idempotent: true,
    });
  });

  it.each([null, undefined, "string", 42, {}, { commentId: 7 }, { commentId: "  " }])(
    "degrades unknown shapes to null/false (%s)",
    (input) => {
      expect(extractNoonAppCommentId(input)).toEqual({ commentId: null, idempotent: false });
    },
  );
});

describe("sendClientCommentToNoonApp", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  function okResponse(body: object): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  function errorResponse(status: number, body = "down"): Response {
    return new Response(body, { status });
  }

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

  async function runSend() {
    const promise = sendClientCommentToNoonApp({
      projectId: "proj-1",
      externalCommentId: "ext-1",
      body: "Looks great!",
      at: "2026-06-15T12:00:00.000Z",
    });
    promise.catch(() => {});
    await vi.runAllTimersAsync();
    return promise;
  }

  it("POSTs the camelCase payload to the client-comment path and returns the parsed reply", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse({ idempotent: false, commentId: "c-1", requestId: "r" }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runSend();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://noon-app.test/api/integrations/website/client-comment");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      projectId: "proj-1",
      externalCommentId: "ext-1",
      author: "client",
      body: "Looks great!",
      at: "2026-06-15T12:00:00.000Z",
    });
    expect(extractNoonAppCommentId(result)).toEqual({ commentId: "c-1", idempotent: false });
  });

  it("surfaces an idempotent replay reply (same commentId)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse({ idempotent: true, commentId: "c-1", requestId: "r" }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runSend();

    expect(extractNoonAppCommentId(result)).toEqual({ commentId: "c-1", idempotent: true });
  });

  it("retries on 5xx and succeeds on the second attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse({ idempotent: false, commentId: "c-2" }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await runSend();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on a deterministic 4xx (e.g. 404 not-activated) and throws", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(errorResponse(404, "no project"));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(runSend()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
