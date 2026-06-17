/**
 * tests/maxwell/client-requests.test.ts
 *
 * The frozen §9 vocabulary + UI copy + guards (lib/maxwell/client-requests.ts).
 * Pure module — no env, no DB.
 */

import { describe, expect, it } from "vitest";
import {
  CLIENT_REQUEST_BODY_MAX,
  CLIENT_REQUEST_BODY_MIN,
  CLIENT_REQUEST_PRIORITIES,
  CLIENT_REQUEST_PRIORITY_LABELS,
  CLIENT_REQUEST_TYPES,
  CLIENT_REQUEST_TYPE_LABELS,
  CLIENT_VISIBLE_STATES,
  CLIENT_VISIBLE_STATE_LABELS,
  clientRequestPrioritySchema,
  clientRequestTypeSchema,
  clientVisibleStateLabel,
  clientVisibleStateSchema,
  isClientRequestPriority,
  isClientRequestType,
} from "@/lib/maxwell/client-requests";

describe("client-request vocabulary (frozen cross-repo)", () => {
  it("freezes the 9 types / 5 priorities / 5 client-visible states", () => {
    expect(CLIENT_REQUEST_TYPES).toEqual([
      "material",
      "comment",
      "bug",
      "adjustment",
      "support",
      "improvement",
      "feature",
      "scope_change",
      "incident",
    ]);
    expect(CLIENT_REQUEST_PRIORITIES).toEqual(["critical", "high", "normal", "low", "backlog"]);
    expect(CLIENT_VISIBLE_STATES).toEqual([
      "received",
      "in_review",
      "in_progress",
      "completed",
      "under_internal_review",
    ]);
  });

  it("body bounds match the frozen contract (1..4000)", () => {
    expect(CLIENT_REQUEST_BODY_MIN).toBe(1);
    expect(CLIENT_REQUEST_BODY_MAX).toBe(4000);
  });

  it("has a non-empty label for every enum member", () => {
    for (const t of CLIENT_REQUEST_TYPES) expect(CLIENT_REQUEST_TYPE_LABELS[t]).toBeTruthy();
    for (const p of CLIENT_REQUEST_PRIORITIES) expect(CLIENT_REQUEST_PRIORITY_LABELS[p]).toBeTruthy();
    for (const s of CLIENT_VISIBLE_STATES) expect(CLIENT_VISIBLE_STATE_LABELS[s]).toBeTruthy();
  });
});

describe("guards + schemas", () => {
  it("string guards accept members and reject anything else", () => {
    expect(isClientRequestType("feature")).toBe(true);
    expect(isClientRequestType("nonsense")).toBe(false);
    expect(isClientRequestPriority("backlog")).toBe(true);
    expect(isClientRequestPriority("urgent")).toBe(false);
  });

  it("Zod schemas parse members and reject non-members", () => {
    expect(clientRequestTypeSchema.parse("bug")).toBe("bug");
    expect(() => clientRequestTypeSchema.parse("oops")).toThrow();
    expect(clientRequestPrioritySchema.parse("low")).toBe("low");
    expect(clientVisibleStateSchema.parse("in_review")).toBe("in_review");
    expect(() => clientVisibleStateSchema.parse("escalated")).toThrow();
  });
});

describe("clientVisibleStateLabel", () => {
  it("falls back to Received for null (no App push yet)", () => {
    expect(clientVisibleStateLabel(null)).toBe("Received");
  });
  it("maps a stored state to its label", () => {
    expect(clientVisibleStateLabel("completed")).toBe("Completed");
    expect(clientVisibleStateLabel("under_internal_review")).toBe("Under internal review");
  });
});
