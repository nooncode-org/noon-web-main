/**
 * tests/maxwell/version-status-labels.test.ts
 *
 * NoonWeb owns the client-facing copy for the App's per-version `state`
 * (master-spec-v3 §8.1; v3 Fase 2 versioning, Slice 2a). These tests lock the
 * state→label/tone mapping, the neutral fallback for an unmapped/internal value,
 * and the `isPublishedVersion` canonical-signal logic.
 */

import { describe, expect, it } from "vitest";
import {
  isPublishedVersion,
  mapVersionStateToMeta,
} from "@/lib/maxwell/version-status-labels";

describe("mapVersionStateToMeta", () => {
  it.each([
    ["ready_for_client_preview", "Preview ready"],
    ["published", "Published"],
    ["previous_published", "Previously published"],
    ["rolled_back", "Rolled back"],
  ])("maps the frozen client-visible state %s to label %s", (state, label) => {
    expect(mapVersionStateToMeta(state).label).toBe(label);
  });

  it("returns a tone with a border class for a known state", () => {
    const meta = mapVersionStateToMeta("published");
    expect(meta.tone).toContain("border");
    expect(meta.tone).toContain("emerald");
  });

  it("degrades an unmapped/internal state to a neutral label (anti-leak + forward-compat)", () => {
    // `draft` is an internal lifecycle value the App must never expose; a future
    // client-visible state would also land here until NoonWeb adds copy.
    for (const state of ["draft", "some_future_state", ""]) {
      const meta = mapVersionStateToMeta(state);
      expect(meta.label).toBe("Version");
      expect(meta.tone).toContain("border");
    }
  });
});

describe("isPublishedVersion", () => {
  it("treats state === 'published' as canonical", () => {
    expect(isPublishedVersion({ state: "published" })).toBe(true);
    expect(isPublishedVersion({ state: "previous_published" })).toBe(false);
    expect(isPublishedVersion({ state: "ready_for_client_preview" })).toBe(false);
  });

  it("honours the convenience boolean when the state lags", () => {
    expect(isPublishedVersion({ state: "ready_for_client_preview", published: true })).toBe(true);
  });

  it("is false when neither signal is set", () => {
    expect(isPublishedVersion({ state: "rolled_back", published: false })).toBe(false);
  });
});
