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
  CLIENT_VISIBLE_STATE_TONE,
  clientRequestPrioritySchema,
  clientRequestTypeSchema,
  clientVisibleStateLabel,
  clientVisibleStateMeta,
  clientVisibleStateSchema,
  isClientRequestPriority,
  isClientRequestType,
  isValidVersionRef,
  ROLLBACK_REQUEST_ENABLED,
  SELECTABLE_CLIENT_REQUEST_TYPES,
  VERSION_REF_MAX,
  VERSION_REF_MIN,
} from "@/lib/maxwell/client-requests";

describe("client-request vocabulary (frozen cross-repo)", () => {
  it("freezes the 10 types / 5 priorities / 5 client-visible states", () => {
    // B.4 (2026-06-20) added the 10th type `rollback`; the App declares the same.
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
      "rollback",
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

describe("B.4 version-linking vocabulary", () => {
  it("rollback is a real type with a label, and is enabled (App deployed it)", () => {
    expect(isClientRequestType("rollback")).toBe(true);
    expect(CLIENT_REQUEST_TYPE_LABELS.rollback).toBeTruthy();
    // Enabled 2026-06-20 after the App deployed its rollback CHECK + receiver.
    expect(ROLLBACK_REQUEST_ENABLED).toBe(true);
  });

  it("the generic form's selectable types exclude rollback (button-initiated)", () => {
    expect(SELECTABLE_CLIENT_REQUEST_TYPES).not.toContain("rollback");
    expect(SELECTABLE_CLIENT_REQUEST_TYPES).toHaveLength(CLIENT_REQUEST_TYPES.length - 1);
    for (const t of SELECTABLE_CLIENT_REQUEST_TYPES) {
      expect(CLIENT_REQUEST_TYPES).toContain(t);
    }
  });

  it("isValidVersionRef enforces an integer in 1..100000 (matches the App backstop)", () => {
    expect(VERSION_REF_MIN).toBe(1);
    expect(VERSION_REF_MAX).toBe(100000);
    expect(isValidVersionRef(1)).toBe(true);
    expect(isValidVersionRef(100000)).toBe(true);
    expect(isValidVersionRef(0)).toBe(false);
    expect(isValidVersionRef(-1)).toBe(false);
    expect(isValidVersionRef(100001)).toBe(false);
    expect(isValidVersionRef(1.5)).toBe(false);
    expect(isValidVersionRef(Number.NaN)).toBe(false);
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

describe("clientVisibleStateMeta (Slice B display)", () => {
  it("has a tone for every client-visible state", () => {
    for (const s of CLIENT_VISIBLE_STATES) expect(CLIENT_VISIBLE_STATE_TONE[s]).toBeTruthy();
  });

  it("returns label + tone, falling back to received for null", () => {
    const nullMeta = clientVisibleStateMeta(null);
    expect(nullMeta.label).toBe("Received");
    expect(nullMeta.tone).toBe(CLIENT_VISIBLE_STATE_TONE.received);

    const done = clientVisibleStateMeta("completed");
    expect(done.label).toBe("Completed");
    expect(done.tone).toBe(CLIENT_VISIBLE_STATE_TONE.completed);
  });
});
