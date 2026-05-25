/**
 * tests/maxwell/prototipo-render-fetch.test.ts
 *
 * Coverage for the D-slice Pull B.2 GET helper (`fetchPrototipoRender`) and
 * the pure UX state mapper (`mapRenderResultToUxState`). HTTP plumbing is
 * exercised via the `fetchImpl` option (preferred over global.fetch mocking)
 * so signing + URL composition + retry behavior can be asserted exactly.
 *
 * The signing convention under test is the empty-body trailing-dot pattern
 * from ADR-024 D1 (`${unix_timestamp}.`). The POST counterpart is covered by
 * `prototipo-decision.test.ts` — the two helpers share `signNoonAppEnvelope`
 * but use different signing inputs (empty body vs serialized JSON).
 */

import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPrototipoRender } from "@/lib/maxwell/prototipo-render-fetch";
import {
  PROTOTIPO_RENDER_ERROR_CODES,
  mapRenderResultToUxState,
  type FetchPrototipoRenderResult,
  type PrototipoRenderData,
  type PrototipoRenderErrorCode,
} from "@/lib/maxwell/prototipo-render-types";

const originalEnv = { ...process.env };
const TEST_SECRET = "test-secret";
const TEST_BASE = "https://noon-app.test";
const TEST_TOKEN = "wsp_abcd1234example5678token";

function makeRenderData(overrides: Partial<PrototipoRenderData> = {}): PrototipoRenderData {
  return {
    workspace: {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      version: 1,
      generatedAt: "2026-05-25T14:32:18.000Z",
    },
    leadContext: {
      businessName: "Acme Co",
      projectTypeLabel: "Landing Page",
    },
    prototype: {
      deployedUrl: "https://acme-prototype-v1.vercel.app",
      generatedHtml: null,
    },
    decision: {
      status: "pending",
      notes: null,
      decidedAt: null,
    },
    lifecycle: {
      tokenSuperseded: false,
      iterationNumber: 1,
    },
    serverTime: "2026-05-25T16:45:02.123Z",
    ...overrides,
  };
}

function okResponse(data: PrototipoRenderData, init: { requestId?: string; cacheControl?: string } = {}): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (init.cacheControl) headers.set("cache-control", init.cacheControl);
  return new Response(
    JSON.stringify({ data, requestId: init.requestId ?? "req-default" }),
    { status: 200, headers },
  );
}

function errorResponse(status: number, body: object | string): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  process.env.NOON_WEBSITE_WEBHOOK_SECRET = TEST_SECRET;
  process.env.NOON_APP_BASE_URL = TEST_BASE;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("fetchPrototipoRender — happy paths", () => {
  it("returns ok + parsed data + requestId + cacheControl on 200", async () => {
    const data = makeRenderData();
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      okResponse(data, { requestId: "req-xyz", cacheControl: "private, max-age=30" }),
    );

    const result = await fetchPrototipoRender(TEST_TOKEN, { fetchImpl });

    expect(result).toEqual({
      status: "ok",
      data,
      requestId: "req-xyz",
      cacheControl: "private, max-age=30",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("signs the request with the empty-body trailing-dot convention", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(okResponse(makeRenderData()));
    // Pin the clock so signature is reproducible.
    const fixedNowMs = 1_716_661_938_000; // 2024-05-25T16:32:18Z, arbitrary
    vi.setSystemTime(fixedNowMs);
    const expectedTimestamp = Math.floor(fixedNowMs / 1000).toString();
    const expectedSignatureHex = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${expectedTimestamp}.`)
      .digest("hex");

    await fetchPrototipoRender(TEST_TOKEN, { fetchImpl });

    const [, init] = fetchImpl.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("GET");
    expect((init as RequestInit).body).toBeUndefined();
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["x-noon-timestamp"]).toBe(expectedTimestamp);
    expect(headers["x-noon-signature"]).toBe(`sha256=${expectedSignatureHex}`);
    // GET MUST NOT include content-type (no body).
    expect(headers["content-type"]).toBeUndefined();
  });

  it("composes the URL with the configured base + path + encoded token", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(okResponse(makeRenderData()));

    await fetchPrototipoRender("token with spaces?", { fetchImpl });

    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      `${TEST_BASE}/api/integrations/website/prototype-signed-read/${encodeURIComponent("token with spaces?")}`,
    );
  });

  it("defaults requestId to null when missing from response body", async () => {
    const data = makeRenderData();
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await fetchPrototipoRender(TEST_TOKEN, { fetchImpl });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.requestId).toBeNull();
      expect(result.cacheControl).toBeNull();
    }
  });
});

describe("fetchPrototipoRender — error code mapping", () => {
  it.each<[number, PrototipoRenderErrorCode]>([
    [404, PROTOTIPO_RENDER_ERROR_CODES.TOKEN_NOT_FOUND],
    [410, PROTOTIPO_RENDER_ERROR_CODES.TOKEN_SUPERSEDED],
    [410, PROTOTIPO_RENDER_ERROR_CODES.LEAD_DELETED],
    [401, PROTOTIPO_RENDER_ERROR_CODES.AUTH_FAILED],
    [429, PROTOTIPO_RENDER_ERROR_CODES.RATE_LIMITED],
  ])("maps HTTP %i to code %s (with explicit App code field)", async (status, code) => {
    const fetchImpl = vi.fn().mockImplementation(async () =>
      errorResponse(status, { error: "X", code, requestId: "req-1" }),
    );

    const promise = fetchPrototipoRender(TEST_TOKEN, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toMatchObject({
      status: "error",
      code,
      httpStatus: status,
      requestId: "req-1",
    });
  });

  it("falls back to status-based bucket when App omits the code field", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => errorResponse(404, "not found"));

    const promise = fetchPrototipoRender(TEST_TOKEN, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_RENDER_ERROR_CODES.TOKEN_NOT_FOUND);
      expect(result.httpStatus).toBe(404);
    }
  });

  it("biases 410 without a code to TOKEN_SUPERSEDED (common case)", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => errorResponse(410, "gone"));

    const promise = fetchPrototipoRender(TEST_TOKEN, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_RENDER_ERROR_CODES.TOKEN_SUPERSEDED);
    }
  });

  it("treats a network error as INTERNAL_FAILED with httpStatus 0", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const promise = fetchPrototipoRender(TEST_TOKEN, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_RENDER_ERROR_CODES.INTERNAL_FAILED);
      expect(result.httpStatus).toBe(0);
    }
  });

  it("treats a non-JSON 200 body as INTERNAL_FAILED", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response("<<not json>>", { status: 200 }),
    );

    const result = await fetchPrototipoRender(TEST_TOKEN, { fetchImpl });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_RENDER_ERROR_CODES.INTERNAL_FAILED);
    }
  });

  it("treats a 200 with malformed data shape as INTERNAL_FAILED", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { workspace: null }, requestId: "req-bad" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await fetchPrototipoRender(TEST_TOKEN, { fetchImpl });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_RENDER_ERROR_CODES.INTERNAL_FAILED);
      expect(result.requestId).toBe("req-bad");
    }
  });

  it("classifies an unknown 4xx as UNKNOWN with the body's error text preserved", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () =>
      errorResponse(418, { error: "I'm a teapot" }),
    );

    const promise = fetchPrototipoRender(TEST_TOKEN, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_RENDER_ERROR_CODES.UNKNOWN);
      expect(result.message).toBe("I'm a teapot");
    }
  });
});

describe("fetchPrototipoRender — retry behavior", () => {
  it("retries once on 500 then surfaces the error after the second failure", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () =>
      errorResponse(500, { code: "PROTOTYPE_READ_INTERNAL_FAILED" }),
    );

    const promise = fetchPrototipoRender(TEST_TOKEN, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_RENDER_ERROR_CODES.INTERNAL_FAILED);
    }
  });

  it("retries once on network error then surfaces INTERNAL_FAILED", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const promise = fetchPrototipoRender(TEST_TOKEN, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_RENDER_ERROR_CODES.INTERNAL_FAILED);
    }
  });

  it("does NOT retry on 429 (per handoff §2.10)", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => errorResponse(429, "too many"));

    const promise = fetchPrototipoRender(TEST_TOKEN, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_RENDER_ERROR_CODES.RATE_LIMITED);
    }
  });

  it("does NOT retry on a terminal 4xx like 404", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () =>
      errorResponse(404, { code: "PROTOTYPE_READ_TOKEN_NOT_FOUND" }),
    );

    const promise = fetchPrototipoRender(TEST_TOKEN, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("error");
  });

  it("does NOT retry on 401 AUTH_FAILED (deterministic, won't resolve)", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () =>
      errorResponse(401, { code: "WEBSITE_WEBHOOK_AUTH_FAILED" }),
    );

    const promise = fetchPrototipoRender(TEST_TOKEN, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("error");
  });

  it("recovers when a 500 is followed by a 200 on retry", async () => {
    const data = makeRenderData();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(500, { code: "PROTOTYPE_READ_INTERNAL_FAILED" }))
      .mockResolvedValueOnce(okResponse(data, { requestId: "req-recovered" }));

    const promise = fetchPrototipoRender(TEST_TOKEN, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.requestId).toBe("req-recovered");
      expect(result.data).toEqual(data);
    }
  });
});

describe("fetchPrototipoRender — misconfigured env", () => {
  it("returns AUTH_FAILED when base URL is missing", async () => {
    delete process.env.NOON_APP_BASE_URL;
    const fetchImpl = vi.fn();

    const result = await fetchPrototipoRender(TEST_TOKEN, { fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_RENDER_ERROR_CODES.AUTH_FAILED);
    }
  });

  it("returns AUTH_FAILED when secret is missing", async () => {
    delete process.env.NOON_WEBSITE_WEBHOOK_SECRET;
    const fetchImpl = vi.fn();

    const result = await fetchPrototipoRender(TEST_TOKEN, { fetchImpl });

    // Secret is read inside the signer; the fetch is never actually issued.
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_RENDER_ERROR_CODES.AUTH_FAILED);
    }
  });
});

describe("mapRenderResultToUxState", () => {
  it("maps decision.status=pending with deployedUrl to ready.pending", () => {
    const result: FetchPrototipoRenderResult = {
      status: "ok",
      data: makeRenderData(),
      requestId: "r",
      cacheControl: null,
    };
    expect(mapRenderResultToUxState(result).kind).toBe("ready.pending");
  });

  it("maps decision.status=pending with both artifact fields null to ready.preparing", () => {
    const result: FetchPrototipoRenderResult = {
      status: "ok",
      data: makeRenderData({
        prototype: { deployedUrl: null, generatedHtml: null },
      }),
      requestId: "r",
      cacheControl: null,
    };
    expect(mapRenderResultToUxState(result).kind).toBe("ready.preparing");
  });

  it("maps decision.status=pending with only generatedHtml to ready.pending", () => {
    const result: FetchPrototipoRenderResult = {
      status: "ok",
      data: makeRenderData({
        prototype: { deployedUrl: null, generatedHtml: "<h1>Hi</h1>" },
      }),
      requestId: "r",
      cacheControl: null,
    };
    expect(mapRenderResultToUxState(result).kind).toBe("ready.pending");
  });

  it("maps decision.status=accepted to ready.accepted", () => {
    const result: FetchPrototipoRenderResult = {
      status: "ok",
      data: makeRenderData({
        decision: { status: "accepted", notes: null, decidedAt: "2026-05-25T10:00:00Z" },
      }),
      requestId: "r",
      cacheControl: null,
    };
    expect(mapRenderResultToUxState(result).kind).toBe("ready.accepted");
  });

  it("maps decision.status=rejected to ready.rejected", () => {
    const result: FetchPrototipoRenderResult = {
      status: "ok",
      data: makeRenderData({
        decision: { status: "rejected", notes: "no", decidedAt: "2026-05-25T10:00:00Z" },
      }),
      requestId: "r",
      cacheControl: null,
    };
    expect(mapRenderResultToUxState(result).kind).toBe("ready.rejected");
  });

  it.each<[PrototipoRenderErrorCode, string]>([
    [PROTOTIPO_RENDER_ERROR_CODES.TOKEN_NOT_FOUND, "terminal.invalid-link"],
    [PROTOTIPO_RENDER_ERROR_CODES.TOKEN_SUPERSEDED, "expired.regenerated"],
    [PROTOTIPO_RENDER_ERROR_CODES.LEAD_DELETED, "expired.lead-deleted"],
    [PROTOTIPO_RENDER_ERROR_CODES.AUTH_FAILED, "transient.auth-failed"],
    [PROTOTIPO_RENDER_ERROR_CODES.RATE_LIMITED, "transient.rate-limited"],
    [PROTOTIPO_RENDER_ERROR_CODES.INTERNAL_FAILED, "transient.internal-failed"],
    [PROTOTIPO_RENDER_ERROR_CODES.UNKNOWN, "fatal.unknown"],
  ])("maps error code %s to UX state %s", (code, kind) => {
    const result: FetchPrototipoRenderResult = {
      status: "error",
      code,
      httpStatus: 500,
      message: "x",
      requestId: null,
    };
    expect(mapRenderResultToUxState(result).kind).toBe(kind);
  });
});
