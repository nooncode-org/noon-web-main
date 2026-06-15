/**
 * tests/maxwell/project-status-fetch.test.ts
 *
 * Coverage for the v3 client-portal project-status signed-read consumer
 * (`fetchNoonAppProjectStatus`, Slice 1a). HTTP plumbing is driven via the
 * `fetchImpl` option so signing + URL composition + retry + the §8.3 anti-leak
 * behavior can be asserted exactly.
 *
 * Signing convention under test: the empty-body trailing-dot pattern
 * (`${unix_timestamp}.`), shared with `fetchPrototipoRender` via
 * `signNoonAppEnvelope`.
 */

import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNoonAppProjectStatus } from "@/lib/maxwell/project-status-fetch";
import {
  PROJECT_STATUS_ERROR_CODES,
  type ProjectStatusData,
  type ProjectStatusErrorCode,
} from "@/lib/maxwell/project-status-types";

const originalEnv = { ...process.env };
const TEST_SECRET = "test-secret";
const TEST_BASE = "https://noon-app.test";
const TEST_PROJECT_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

function makeStatusData(overrides: Partial<ProjectStatusData> = {}): ProjectStatusData {
  return {
    project: {
      id: TEST_PROJECT_ID,
      name: "Acme Landing",
      status: "in_progress",
    },
    proposal: {
      title: "Acme marketing landing page",
      amount: 1500,
      currency: "USD",
      paymentStatus: "paid",
    },
    payment: { activated: true, status: "paid" },
    versions: [],
    latestUpdate: {
      kind: "status_changed",
      status: "in_progress",
      at: "2026-06-15T10:00:00.000Z",
    },
    serverTime: "2026-06-15T12:00:00.000Z",
    ...overrides,
  };
}

function okResponse(
  data: unknown,
  init: { requestId?: string | null; cacheControl?: string } = {},
): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (init.cacheControl) headers.set("cache-control", init.cacheControl);
  const body: Record<string, unknown> = { data };
  if (init.requestId !== null) body.requestId = init.requestId ?? "req-default";
  return new Response(JSON.stringify(body), { status: 200, headers });
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

describe("fetchNoonAppProjectStatus — happy paths", () => {
  it("returns ok + parsed data + requestId + cacheControl on 200", async () => {
    const data = makeStatusData();
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      okResponse(data, {
        requestId: "req-xyz",
        cacheControl: "private, max-age=30, stale-while-revalidate=60",
      }),
    );

    const result = await fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });

    expect(result).toEqual({
      status: "ok",
      data,
      requestId: "req-xyz",
      cacheControl: "private, max-age=30, stale-while-revalidate=60",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("signs the request with the empty-body trailing-dot convention", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(okResponse(makeStatusData()));
    const fixedNowMs = 1_716_661_938_000;
    vi.setSystemTime(fixedNowMs);
    const expectedTimestamp = Math.floor(fixedNowMs / 1000).toString();
    const expectedSignatureHex = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${expectedTimestamp}.`)
      .digest("hex");

    await fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });

    const [, init] = fetchImpl.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("GET");
    expect((init as RequestInit).body).toBeUndefined();
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["x-noon-timestamp"]).toBe(expectedTimestamp);
    expect(headers["x-noon-signature"]).toBe(`sha256=${expectedSignatureHex}`);
    // GET MUST NOT include content-type (no body).
    expect(headers["content-type"]).toBeUndefined();
  });

  it("composes the URL with base + path + encoded projectId", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(okResponse(makeStatusData()));

    await fetchNoonAppProjectStatus("proj id/with?", { fetchImpl });

    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      `${TEST_BASE}/api/integrations/website/project-status/${encodeURIComponent("proj id/with?")}`,
    );
  });

  it("defaults requestId to null when missing from the response body", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      okResponse(makeStatusData(), { requestId: null }),
    );

    const result = await fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.requestId).toBeNull();
      expect(result.cacheControl).toBeNull();
    }
  });

  it("tolerates a null proposal and null latestUpdate", async () => {
    const data = makeStatusData({ proposal: null, latestUpdate: null });
    const fetchImpl = vi.fn().mockResolvedValueOnce(okResponse(data));

    const result = await fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.proposal).toBeNull();
      expect(result.data.latestUpdate).toBeNull();
    }
  });
});

describe("fetchNoonAppProjectStatus — §8.3 boundary enforcement", () => {
  it("strips unmodeled keys (forward-compat — e.g. a Fase 2 field)", async () => {
    const data = {
      ...makeStatusData(),
      project: { id: TEST_PROJECT_ID, name: "Acme", status: "in_progress", futureField: "x" },
    };
    const fetchImpl = vi.fn().mockResolvedValueOnce(okResponse(data));

    const result = await fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect((result.data.project as Record<string, unknown>).futureField).toBeUndefined();
    }
  });

  it("strips a leaked snake_case internal column (`budget`) via the allowlist", async () => {
    // `budget` is the App's internal cost — §3.2's sharpest leak. It is not in
    // NoonWeb's camelCase denylist, so the Zod allowlist (not the tripwire) is
    // what guarantees it never reaches the UI.
    const data = {
      ...makeStatusData(),
      project: { id: TEST_PROJECT_ID, name: "Acme", status: "in_progress", budget: 99999 },
    };
    const fetchImpl = vi.fn().mockResolvedValueOnce(okResponse(data));

    const result = await fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect((result.data.project as Record<string, unknown>).budget).toBeUndefined();
    }
  });

  it("trips assertNoInternalFields on a leaked camelCase internal field", async () => {
    const data = {
      ...makeStatusData(),
      proposal: {
        title: "Acme",
        amount: 1500,
        currency: "USD",
        paymentStatus: "paid",
        reviewerId: "staff-7", // camelCase internal field — must trip the guard
      },
    };
    const fetchImpl = vi.fn().mockResolvedValueOnce(okResponse(data, { requestId: "req-leak" }));

    const result = await fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROJECT_STATUS_ERROR_CODES.INTERNAL_FAILED);
      expect(result.message).toContain("reviewerId");
      expect(result.requestId).toBe("req-leak");
    }
  });
});

describe("fetchNoonAppProjectStatus — error mapping", () => {
  it.each<[number, ProjectStatusErrorCode]>([
    [404, PROJECT_STATUS_ERROR_CODES.NOT_FOUND],
    [401, PROJECT_STATUS_ERROR_CODES.AUTH_FAILED],
    [429, PROJECT_STATUS_ERROR_CODES.RATE_LIMITED],
    [400, PROJECT_STATUS_ERROR_CODES.INVALID_REQUEST],
  ])("maps HTTP %i to %s (with explicit App code)", async (status, code) => {
    const fetchImpl = vi.fn().mockImplementation(async () =>
      errorResponse(status, { error: "X", code, requestId: "req-1" }),
    );

    const promise = fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toMatchObject({ status: "error", code, httpStatus: status, requestId: "req-1" });
  });

  it("falls back to status-based bucket when App omits the code field", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => errorResponse(404, "not found"));

    const promise = fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROJECT_STATUS_ERROR_CODES.NOT_FOUND);
      expect(result.httpStatus).toBe(404);
    }
  });

  it("treats a network error as INTERNAL_FAILED with httpStatus 0", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const promise = fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROJECT_STATUS_ERROR_CODES.INTERNAL_FAILED);
      expect(result.httpStatus).toBe(0);
    }
  });

  it("treats a non-JSON 200 body as INTERNAL_FAILED", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response("<<not json>>", { status: 200 }));

    const result = await fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROJECT_STATUS_ERROR_CODES.INTERNAL_FAILED);
    }
  });

  it("treats a 200 with a malformed shape as INTERNAL_FAILED", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { project: { id: 1 } }, requestId: "req-bad" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROJECT_STATUS_ERROR_CODES.INTERNAL_FAILED);
      expect(result.requestId).toBe("req-bad");
    }
  });
});

describe("fetchNoonAppProjectStatus — retry behavior", () => {
  it("retries once on 500 then surfaces the error", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () =>
      errorResponse(500, { code: "PROJECT_STATUS_INTERNAL_FAILED" }),
    );

    const promise = fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROJECT_STATUS_ERROR_CODES.INTERNAL_FAILED);
    }
  });

  it("recovers when a 500 is followed by a 200 on retry", async () => {
    const data = makeStatusData();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(500, { code: "PROJECT_STATUS_INTERNAL_FAILED" }))
      .mockResolvedValueOnce(okResponse(data, { requestId: "req-recovered" }));

    const promise = fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.requestId).toBe("req-recovered");
    }
  });

  it("does NOT retry on 429", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => errorResponse(429, "too many"));

    const promise = fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROJECT_STATUS_ERROR_CODES.RATE_LIMITED);
    }
  });

  it("does NOT retry on a terminal 404", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () =>
      errorResponse(404, { code: "PROJECT_STATUS_NOT_FOUND" }),
    );

    const promise = fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("error");
  });

  it("does NOT retry on 401 AUTH_FAILED", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () =>
      errorResponse(401, { code: "WEBSITE_WEBHOOK_AUTH_FAILED" }),
    );

    const promise = fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("error");
  });

  it("retries once on a network error then surfaces INTERNAL_FAILED", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const promise = fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("error");
  });
});

describe("fetchNoonAppProjectStatus — misconfigured env", () => {
  it("returns AUTH_FAILED when base URL is missing (no fetch issued)", async () => {
    delete process.env.NOON_APP_BASE_URL;
    const fetchImpl = vi.fn();

    const result = await fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROJECT_STATUS_ERROR_CODES.AUTH_FAILED);
    }
  });

  it("returns AUTH_FAILED when the secret is missing (no fetch issued)", async () => {
    delete process.env.NOON_WEBSITE_WEBHOOK_SECRET;
    const fetchImpl = vi.fn();

    const result = await fetchNoonAppProjectStatus(TEST_PROJECT_ID, { fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROJECT_STATUS_ERROR_CODES.AUTH_FAILED);
    }
  });
});
