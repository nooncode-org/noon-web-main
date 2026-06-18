/**
 * tests/maxwell/version-action-integration.test.ts
 *
 * The v3 Fase 2 (versioning, Slice 2b) outbound wire helpers in
 * lib/noon-app-integration.ts:
 *   - buildVersionActionPayload (frozen camelCase shape, publish-only),
 *   - extractNoonAppVersionActionAck (best-effort reply parse).
 */

import { describe, expect, it } from "vitest";
import {
  buildVersionActionPayload,
  extractNoonAppVersionActionAck,
} from "@/lib/noon-app-integration";

describe("buildVersionActionPayload", () => {
  it("emits the frozen camelCase shape with action fixed to publish (MVP)", () => {
    expect(
      buildVersionActionPayload({
        projectId: "proj-1",
        versionSequenceNumber: 3,
        externalActionId: "act-1",
        at: "2026-06-18T10:00:00.000Z",
      }),
    ).toEqual({
      action: "publish",
      projectId: "proj-1",
      versionSequenceNumber: 3,
      externalActionId: "act-1",
      at: "2026-06-18T10:00:00.000Z",
    });
  });

  it("defaults `at` to an ISO timestamp when omitted", () => {
    const payload = buildVersionActionPayload({
      projectId: "p",
      versionSequenceNumber: 1,
      externalActionId: "a",
    });
    expect(typeof payload.at).toBe("string");
    expect(Number.isNaN(Date.parse(payload.at))).toBe(false);
  });
});

describe("extractNoonAppVersionActionAck", () => {
  it("pulls the published state from a well-formed reply", () => {
    expect(
      extractNoonAppVersionActionAck({
        idempotent: false,
        publishedSequence: 3,
        publishedUrl: "https://acme.example",
        requestId: "app-a-1",
      }),
    ).toEqual({
      idempotent: false,
      publishedSequence: 3,
      publishedUrl: "https://acme.example",
      requestId: "app-a-1",
    });
  });

  it("reflects an idempotent replay", () => {
    expect(extractNoonAppVersionActionAck({ idempotent: true, publishedSequence: 2 })).toMatchObject(
      { idempotent: true, publishedSequence: 2 },
    );
  });

  it("degrades to nulls/false on an unrecognised shape", () => {
    for (const shape of [null, "nope", {}, { publishedSequence: "2" }]) {
      expect(extractNoonAppVersionActionAck(shape)).toEqual({
        idempotent: false,
        publishedSequence: null,
        publishedUrl: null,
        requestId: null,
      });
    }
  });

  it("drops a blank publishedUrl", () => {
    expect(extractNoonAppVersionActionAck({ publishedUrl: "   " }).publishedUrl).toBeNull();
  });
});
