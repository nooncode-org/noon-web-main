/**
 * tests/maxwell/client-request-integration.test.ts
 *
 * The §9 outbound wire helpers in lib/noon-app-integration.ts:
 *   - deriveSubmitterId (HMAC opaque id),
 *   - buildClientRequestPayload (frozen camelCase shape),
 *   - extractNoonAppRequestAck (best-effort reply parse).
 */

import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildClientRequestPayload,
  deriveSubmitterId,
  extractNoonAppRequestAck,
} from "@/lib/noon-app-integration";

const SECRET = "test-shared-secret";
const previous = process.env.NOON_WEBSITE_WEBHOOK_SECRET;

beforeAll(() => {
  process.env.NOON_WEBSITE_WEBHOOK_SECRET = SECRET;
});
afterAll(() => {
  if (previous === undefined) delete process.env.NOON_WEBSITE_WEBHOOK_SECRET;
  else process.env.NOON_WEBSITE_WEBHOOK_SECRET = previous;
});

describe("deriveSubmitterId", () => {
  it("is HMAC-SHA256 of the normalized email (64-char hex)", () => {
    const id = deriveSubmitterId("Client@Example.com");
    const expected = crypto
      .createHmac("sha256", SECRET)
      .update("client@example.com")
      .digest("hex");
    expect(id).toBe(expected);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalizes case + surrounding whitespace (stable per human)", () => {
    expect(deriveSubmitterId("  Client@Example.com ")).toBe(deriveSubmitterId("client@example.com"));
  });

  it("differs per email and never exposes the raw email", () => {
    const a = deriveSubmitterId("a@example.com");
    const b = deriveSubmitterId("b@example.com");
    expect(a).not.toBe(b);
    expect(a).not.toContain("@");
  });
});

describe("buildClientRequestPayload", () => {
  it("emits the frozen camelCase shape", () => {
    expect(
      buildClientRequestPayload({
        projectId: "proj-1",
        externalRequestId: "req-1",
        submittedBy: "hash",
        type: "feature",
        clientPriority: "high",
        body: "Please add X",
        at: "2026-06-17T10:00:00.000Z",
      }),
    ).toEqual({
      externalRequestId: "req-1",
      projectId: "proj-1",
      submittedBy: "hash",
      type: "feature",
      clientPriority: "high",
      body: "Please add X",
      at: "2026-06-17T10:00:00.000Z",
    });
  });

  it("defaults `at` to an ISO timestamp when omitted", () => {
    const payload = buildClientRequestPayload({
      projectId: "p",
      externalRequestId: "r",
      submittedBy: "s",
      type: "bug",
      clientPriority: "normal",
      body: "x",
    });
    expect(typeof payload.at).toBe("string");
    expect(Number.isNaN(Date.parse(payload.at))).toBe(false);
  });
});

describe("extractNoonAppRequestAck", () => {
  it("pulls requestId + idempotent from a well-formed reply", () => {
    expect(extractNoonAppRequestAck({ requestId: "app-r-1", idempotent: true })).toEqual({
      requestId: "app-r-1",
      idempotent: true,
    });
  });

  it("degrades to nulls/false on an unrecognised shape", () => {
    expect(extractNoonAppRequestAck(null)).toEqual({ requestId: null, idempotent: false });
    expect(extractNoonAppRequestAck("nope")).toEqual({ requestId: null, idempotent: false });
    expect(extractNoonAppRequestAck({})).toEqual({ requestId: null, idempotent: false });
  });
});
