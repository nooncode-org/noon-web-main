/**
 * tests/maxwell/ai-mvp-milestone-copy.test.ts
 *
 * Unit tests for the §19.3 client-copy mapping and current-milestone picker
 * used by the workspace page to render App's post-payment AI MVP status.
 */

import { describe, expect, it } from "vitest";
import type { AiMvpMilestone } from "@/lib/maxwell/repositories";
import {
  AI_MVP_MILESTONE_COPY,
  pickCurrentMilestone,
} from "@/lib/maxwell/ai-mvp-milestone-copy";

function milestone(overrides: Partial<AiMvpMilestone> = {}): AiMvpMilestone {
  return {
    id: "m-1",
    projectId: "proj-1",
    kind: "started",
    versionUrl: null,
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("AI_MVP_MILESTONE_COPY", () => {
  it("has copy for every milestone kind", () => {
    expect(Object.keys(AI_MVP_MILESTONE_COPY).sort()).toEqual([
      "escalated",
      "started",
      "version-ready",
    ]);
  });

  it("matches the handoff §19.3 labels", () => {
    expect(AI_MVP_MILESTONE_COPY.started.label).toBe(
      "Preparing your first version",
    );
    expect(AI_MVP_MILESTONE_COPY["version-ready"].label).toBe(
      "First version available",
    );
    expect(AI_MVP_MILESTONE_COPY.escalated.label).toBe(
      "Our team is preparing your project",
    );
  });

  it("every entry has a non-empty label and description", () => {
    for (const copy of Object.values(AI_MVP_MILESTONE_COPY)) {
      expect(copy.label.length).toBeGreaterThan(0);
      expect(copy.description.length).toBeGreaterThan(0);
    }
  });
});

describe("pickCurrentMilestone", () => {
  it("returns null for an empty list", () => {
    expect(pickCurrentMilestone([])).toBeNull();
  });

  it("returns the first (newest) milestone — the list is newest-first", () => {
    const list = [
      milestone({ id: "newest", kind: "version-ready" }),
      milestone({ id: "older", kind: "started" }),
    ];
    expect(pickCurrentMilestone(list)?.id).toBe("newest");
  });

  it("skips kinds without copy and falls through to the next known one", () => {
    const list = [
      milestone({ id: "unknown", kind: "future-kind" as AiMvpMilestone["kind"] }),
      milestone({ id: "known", kind: "started" }),
    ];
    expect(pickCurrentMilestone(list)?.id).toBe("known");
  });

  it("returns null when no milestone has known copy", () => {
    const list = [
      milestone({ id: "x", kind: "future-kind" as AiMvpMilestone["kind"] }),
    ];
    expect(pickCurrentMilestone(list)).toBeNull();
  });
});
