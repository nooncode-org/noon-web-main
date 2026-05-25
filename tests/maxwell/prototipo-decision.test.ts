/**
 * tests/maxwell/prototipo-decision.test.ts
 *
 * Coverage for the D-slice helper (`submitPrototipoDecision`) and the pure UX
 * state mapper (`mapResultToUxState`). The HTTP plumbing is exercised by mocking
 * `global.fetch`, mirroring the pattern in `noon-app-integration.test.ts` so the
 * test surface stays close to real wire behavior.
 *
 * Out of scope here:
 *   - The Pull B.2 render fetch (blocked on App-side signed-read endpoint spec).
 *   - The route file under `app/[locale]/maxwell/prototipo/[token]` — covered by
 *     a Playwright a11y spec once the route ships behind its feature flag.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitPrototipoDecision } from "@/lib/maxwell/prototipo-decision";
import {
  PROTOTIPO_DECISION_ERROR_CODES,
  mapResultToUxState,
  type PrototipoDecisionErrorCode,
  type SubmitPrototipoDecisionResult,
} from "@/lib/maxwell/prototipo-decision-types";

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

function okResponse(body: object): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number, body: object | string): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status });
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

describe("submitPrototipoDecision — happy paths", () => {
  it("returns ok + isReplay=false on first successful POST", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(okResponse({ ok: true, idempotent: false }));

    const result = await submitPrototipoDecision({
      token: "tok-123",
      prototypeWorkspaceId: "ws-abc",
      decision: "accepted",
      notes: "Looks great",
      clientUserAgent: "Mozilla/5.0 (Test)",
    });

    expect(result).toEqual({ status: "ok", isReplay: false });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns ok + isReplay=true on bit-identical replay", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(okResponse({ ok: true, idempotent: true }));

    const result = await submitPrototipoDecision({
      token: "tok-123",
      prototypeWorkspaceId: "ws-abc",
      decision: "rejected",
      notes: "Try again",
    });

    expect(result).toEqual({ status: "ok", isReplay: true });
  });

  it("defaults isReplay to false when App body omits the idempotent flag", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(okResponse({ ok: true }));

    const result = await submitPrototipoDecision({
      token: "tok-123",
      prototypeWorkspaceId: "ws-abc",
      decision: "accepted",
    });

    expect(result).toEqual({ status: "ok", isReplay: false });
  });

  it("strips whitespace-only notes from the payload", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(okResponse({ ok: true }));
    global.fetch = fetchMock;

    await submitPrototipoDecision({
      token: "tok-123",
      prototypeWorkspaceId: "ws-abc",
      decision: "accepted",
      notes: "   ",
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).not.toHaveProperty("notes");
  });

  it("omits client_user_agent when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(okResponse({ ok: true }));
    global.fetch = fetchMock;

    await submitPrototipoDecision({
      token: "tok-123",
      prototypeWorkspaceId: "ws-abc",
      decision: "accepted",
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).not.toHaveProperty("client_user_agent");
    expect(body.token).toBe("tok-123");
    expect(body.prototype_workspace_id).toBe("ws-abc");
  });
});

describe("submitPrototipoDecision — error code mapping", () => {
  it.each([
    [404, "PROTOTYPE_DECISION_TOKEN_NOT_FOUND"],
    [409, "PROTOTYPE_DECISION_ALREADY_DECIDED"],
    [409, "PROTOTYPE_DECISION_IDENTIFIER_MISMATCH"],
    [410, "PROTOTYPE_DECISION_TOKEN_EXPIRED"],
    [410, "PROTOTYPE_DECISION_LEAD_DELETED"],
    [400, "PROTOTYPE_DECISION_INVALID_DECISION"],
    [500, "PROTOTYPE_DECISION_PERSIST_FAILED"],
  ])("maps HTTP %i with code %s to the structured error result", async (status, code) => {
    // Factory so each retry attempt gets a fresh, unread Response body.
    global.fetch = vi.fn().mockImplementation(async () =>
      errorResponse(status, { error: "X", code, requestId: "req-1" }),
    );

    const promise = submitPrototipoDecision({
      token: "tok-123",
      prototypeWorkspaceId: "ws-abc",
      decision: "rejected",
    });
    // 5xx errors trigger the inherited 3-attempt retry loop; advance timers.
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toMatchObject({
      status: "error",
      code,
      httpStatus: status,
      requestId: "req-1",
    });
  });

  it("falls back to AUTH_FAILED for 401 when App did not return a structured code", async () => {
    global.fetch = vi.fn().mockImplementation(async () => errorResponse(401, "unauthorized"));

    const promise = submitPrototipoDecision({
      token: "tok-123",
      prototypeWorkspaceId: "ws-abc",
      decision: "accepted",
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_DECISION_ERROR_CODES.AUTH_FAILED);
      expect(result.httpStatus).toBe(401);
    }
  });

  it("falls back to RATE_LIMITED for 429 when App did not return a structured code", async () => {
    global.fetch = vi.fn().mockImplementation(async () => errorResponse(429, "too many"));

    const promise = submitPrototipoDecision({
      token: "tok-123",
      prototypeWorkspaceId: "ws-abc",
      decision: "accepted",
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_DECISION_ERROR_CODES.RATE_LIMITED);
    }
  });

  it("classifies an unknown 4xx as UNKNOWN_ERROR with the body's error text preserved", async () => {
    global.fetch = vi.fn().mockImplementation(async () =>
      errorResponse(418, { error: "I'm a teapot" }),
    );

    const promise = submitPrototipoDecision({
      token: "tok-123",
      prototypeWorkspaceId: "ws-abc",
      decision: "accepted",
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_DECISION_ERROR_CODES.UNKNOWN);
      expect(result.message).toBe("I'm a teapot");
    }
  });

  it("treats a malformed JSON body on 4xx as best-effort and uses status fallback", async () => {
    global.fetch = vi.fn().mockImplementation(async () => errorResponse(404, "<<not json>>"));

    const promise = submitPrototipoDecision({
      token: "tok-123",
      prototypeWorkspaceId: "ws-abc",
      decision: "rejected",
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      // No structured code → status-based fallback. 404 outside the known codes
      // routes to UNKNOWN (the 5 named PROTOTYPE_* codes are only assumed when the
      // code field is present and matches).
      expect(result.code).toBe(PROTOTIPO_DECISION_ERROR_CODES.UNKNOWN);
    }
  });

  it("treats a network error as PERSIST_FAILED with httpStatus 0", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const promise = submitPrototipoDecision({
      token: "tok-123",
      prototypeWorkspaceId: "ws-abc",
      decision: "accepted",
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe(PROTOTIPO_DECISION_ERROR_CODES.PERSIST_FAILED);
      expect(result.httpStatus).toBe(0);
    }
  });
});

describe("mapResultToUxState", () => {
  it("maps ok + accepted to confirmed.accepted", () => {
    expect(
      mapResultToUxState({ status: "ok", isReplay: false }, "accepted"),
    ).toEqual({ kind: "confirmed.accepted" });
  });

  it("maps ok + rejected to confirmed.rejected", () => {
    expect(
      mapResultToUxState({ status: "ok", isReplay: false }, "rejected"),
    ).toEqual({ kind: "confirmed.rejected" });
  });

  it("maps ok + isReplay to already-decided.read-only regardless of decision", () => {
    expect(
      mapResultToUxState({ status: "ok", isReplay: true }, "accepted"),
    ).toEqual({ kind: "already-decided.read-only" });
    expect(
      mapResultToUxState({ status: "ok", isReplay: true }, "rejected"),
    ).toEqual({ kind: "already-decided.read-only" });
  });

  it.each<[PrototipoDecisionErrorCode, string]>([
    [PROTOTIPO_DECISION_ERROR_CODES.TOKEN_NOT_FOUND, "terminal.invalid-link"],
    [PROTOTIPO_DECISION_ERROR_CODES.ALREADY_DECIDED, "already-decided.read-only"],
    [PROTOTIPO_DECISION_ERROR_CODES.IDENTIFIER_MISMATCH, "terminal.identifier-mismatch"],
    [PROTOTIPO_DECISION_ERROR_CODES.TOKEN_EXPIRED, "expired.regenerated"],
    [PROTOTIPO_DECISION_ERROR_CODES.LEAD_DELETED, "expired.lead-deleted"],
    [PROTOTIPO_DECISION_ERROR_CODES.PERSIST_FAILED, "transient.persist-failed"],
    [PROTOTIPO_DECISION_ERROR_CODES.RATE_LIMITED, "transient.rate-limited"],
    [PROTOTIPO_DECISION_ERROR_CODES.INVALID_DECISION, "fatal.unknown"],
    [PROTOTIPO_DECISION_ERROR_CODES.AUTH_FAILED, "fatal.unknown"],
    [PROTOTIPO_DECISION_ERROR_CODES.UNKNOWN, "fatal.unknown"],
  ])("maps error code %s to UX state %s", (code, kind) => {
    const result: SubmitPrototipoDecisionResult = {
      status: "error",
      code,
      httpStatus: 400,
      message: "test",
    };
    expect(mapResultToUxState(result, "accepted").kind).toBe(kind);
  });
});
