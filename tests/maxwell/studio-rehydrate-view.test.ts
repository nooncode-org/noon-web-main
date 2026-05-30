/**
 * tests/maxwell/studio-rehydrate-view.test.ts
 *
 * Coverage for the pure rehydrate mapper (`resolveRehydratedStudioView`). It
 * decides the local studio phase + failure flag when a session is restored, so
 * an orphaned in-flight session (the user navigated away mid-generation; this
 * client is no longer polling) renders a terminal state instead of an infinite
 * "Building prototype..." spinner.
 */

import { describe, expect, it } from "vitest";
import { resolveRehydratedStudioView } from "@/lib/maxwell/studio-rehydrate-view";
import type { StudioStatus } from "@/lib/maxwell/repositories";

describe("resolveRehydratedStudioView", () => {
  it("flags retryable failure for generating_prototype with no version (the reported bug)", () => {
    expect(resolveRehydratedStudioView("generating_prototype", 0)).toEqual({
      phase: "clarifying",
      prototypeFailed: true,
    });
  });

  it("flags retryable failure for revision_requested with no version", () => {
    expect(resolveRehydratedStudioView("revision_requested", 0)).toEqual({
      phase: "clarifying",
      prototypeFailed: true,
    });
  });

  it("falls back to the existing prototype when an in-flight session has versions", () => {
    expect(resolveRehydratedStudioView("generating_prototype", 1)).toEqual({
      phase: "prototype_ready",
      prototypeFailed: false,
    });
    expect(resolveRehydratedStudioView("revision_requested", 2)).toEqual({
      phase: "prototype_ready",
      prototypeFailed: false,
    });
  });

  it("passes non-transient statuses through unchanged and never flags failure", () => {
    const passthrough: StudioStatus[] = [
      "intake",
      "clarifying",
      "prototype_ready",
      "revision_applied",
      "prototype_shared",
      "approved_for_proposal",
      "proposal_pending_review",
      "proposal_sent",
      "converted",
    ];

    for (const status of passthrough) {
      // version count must not change the outcome for non-transient statuses
      expect(resolveRehydratedStudioView(status, 0)).toEqual({
        phase: status,
        prototypeFailed: false,
      });
      expect(resolveRehydratedStudioView(status, 3)).toEqual({
        phase: status,
        prototypeFailed: false,
      });
    }
  });
});
