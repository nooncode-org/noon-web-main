/**
 * tests/maxwell/project-status-types.test.ts
 *
 * Locks the consumer schema for the project-status pull across the v3 Fase 2
 * versioning contract change (co-signed 2026-06-18). The critical regression
 * guard: the per-version `state` was a `z.literal("ready_for_client_preview")`
 * in Slice 1a; Fase 2 widened it to the App's publish lifecycle. A literal/enum
 * would reject a `"published"` row and fail the ENTIRE versions[] (and the whole
 * status read) the moment the App publishes. These tests assert both the new
 * frozen shape and the pre-Fase-2 shape still parse, and that the allowlist
 * still strips unknown/internal keys.
 */

import { describe, expect, it } from "vitest";
import {
  projectStatusDataSchema,
  projectStatusVersionSchema,
} from "@/lib/maxwell/project-status-types";

function baseData(): Record<string, unknown> {
  return {
    project: { id: "p1", name: "Acme", status: "in_progress" },
    proposal: null,
    payment: { activated: true, status: "paid" },
    versions: [],
    latestUpdate: null,
    serverTime: "2026-06-18T12:00:00.000Z",
  };
}

describe("projectStatusVersionSchema (Fase 2)", () => {
  it.each(["ready_for_client_preview", "published", "previous_published", "rolled_back"])(
    "accepts the frozen client-visible state %s",
    (state) => {
      const parsed = projectStatusVersionSchema.safeParse({
        sequence: 1,
        state,
        previewUrl: "https://preview.example/v1",
        at: "2026-06-18T10:00:00.000Z",
        published: state === "published",
      });
      expect(parsed.success).toBe(true);
    },
  );

  it("accepts a brand-new/unknown state without rejecting (the regression we fixed)", () => {
    const parsed = projectStatusVersionSchema.safeParse({
      sequence: 2,
      state: "some_future_state",
      previewUrl: null,
      at: "2026-06-18T10:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("still parses the pre-Fase-2 row that omits `published`", () => {
    const parsed = projectStatusVersionSchema.safeParse({
      sequence: 1,
      state: "ready_for_client_preview",
      previewUrl: null,
      at: "2026-06-18T10:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("projectStatusDataSchema (Fase 2)", () => {
  it("parses the full frozen Fase 2 payload (versions + publishedSequence + publishedUrl)", () => {
    const parsed = projectStatusDataSchema.safeParse({
      ...baseData(),
      versions: [
        {
          sequence: 1,
          state: "previous_published",
          previewUrl: "https://preview.example/v1",
          at: "2026-06-17T10:00:00.000Z",
          published: false,
        },
        {
          sequence: 2,
          state: "published",
          previewUrl: "https://preview.example/v2",
          at: "2026-06-18T10:00:00.000Z",
          published: true,
        },
      ],
      publishedSequence: 2,
      publishedUrl: "https://acme.example",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.publishedSequence).toBe(2);
      expect(parsed.data.publishedUrl).toBe("https://acme.example");
      expect(parsed.data.versions).toHaveLength(2);
    }
  });

  it("still parses a pre-Fase-2 payload with no published fields (forward-compat both ways)", () => {
    const parsed = projectStatusDataSchema.safeParse({
      ...baseData(),
      versions: [
        {
          sequence: 1,
          state: "ready_for_client_preview",
          previewUrl: null,
          at: "2026-06-18T10:00:00.000Z",
        },
      ],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.publishedSequence ?? null).toBeNull();
      expect(parsed.data.publishedUrl ?? null).toBeNull();
    }
  });

  it("strips unknown/internal keys via the positive allowlist (anti-leak §8.3)", () => {
    const parsed = projectStatusDataSchema.safeParse({
      ...baseData(),
      publishedUrl: "https://acme.example",
      // Internal fields the App must never expose — must be dropped, not surfaced.
      rollback_reason: "client asked",
      validation_outcome: "passed",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("rollback_reason");
      expect(parsed.data).not.toHaveProperty("validation_outcome");
    }
  });
});
