/**
 * tests/maxwell/activity-feed.test.ts
 *
 * The §22.2 synthesized client-visible activity feed (lib/maxwell/activity-feed.ts).
 * Pure module — no DB, no env.
 */

import { describe, expect, it } from "vitest";
import { buildActivityFeed } from "@/lib/maxwell/activity-feed";
import type { ClientRequest, WorkspaceUpdate } from "@/lib/maxwell/repositories";
import type { ProjectStatusVersion } from "@/lib/maxwell/project-status-types";

function update(p: Partial<WorkspaceUpdate> & Pick<WorkspaceUpdate, "id" | "title" | "createdAt">): WorkspaceUpdate {
  return {
    id: p.id,
    clientWorkspaceId: "ws-1",
    title: p.title,
    content: p.content ?? null,
    updateType: p.updateType ?? "status_update",
    materialUrl: p.materialUrl ?? null,
    isClientVisible: true,
    createdBy: "noon",
    createdAt: p.createdAt,
  };
}

function version(p: Partial<ProjectStatusVersion> & Pick<ProjectStatusVersion, "sequence" | "at">): ProjectStatusVersion {
  return {
    sequence: p.sequence,
    state: p.state ?? "ready_for_client_preview",
    previewUrl: p.previewUrl ?? null,
    at: p.at,
    published: p.published,
  };
}

function request(p: Partial<ClientRequest> & Pick<ClientRequest, "id" | "type" | "createdAt">): ClientRequest {
  return {
    id: p.id,
    clientWorkspaceId: "ws-1",
    type: p.type,
    clientPriority: p.clientPriority ?? "normal",
    body: p.body ?? "x",
    versionRef: p.versionRef ?? null,
    submittedBy: "hash",
    externalRequestId: p.id,
    forwardedAt: p.forwardedAt ?? null,
    clientVisibleState: p.clientVisibleState ?? null,
    stateRevision: p.stateRevision ?? 0,
    stateUpdatedAt: p.stateUpdatedAt ?? null,
    createdAt: p.createdAt,
  };
}

describe("buildActivityFeed", () => {
  it("returns an empty feed for empty inputs", () => {
    expect(buildActivityFeed({ updates: [], versions: [], requests: [] })).toEqual([]);
  });

  it("includes one event per source with the right kind + tag", () => {
    const feed = buildActivityFeed({
      updates: [update({ id: "u1", title: "Kickoff", updateType: "milestone", createdAt: "2026-06-01T00:00:00.000Z" })],
      versions: [version({ sequence: 1, state: "ready_for_client_preview", previewUrl: "https://p/1", at: "2026-06-02T00:00:00.000Z" })],
      requests: [request({ id: "r1", type: "bug", createdAt: "2026-06-03T00:00:00.000Z" })],
    });
    const byKind = Object.fromEntries(feed.map((e) => [e.kind, e]));
    expect(byKind.update.tag).toBe("Milestone");
    expect(byKind.version.tag).toBe("Version");
    expect(byKind.version.title).toBe("Version 1");
    expect(byKind.version.detail).toBe("Preview ready"); // mapVersionStateToMeta
    expect(byKind.version.href).toBe("https://p/1");
    expect(byKind.request.tag).toBe("Request");
    expect(byKind.request.title).toBe("Request: Bug / problem");
  });

  it("orders the whole feed newest-first by timestamp", () => {
    const feed = buildActivityFeed({
      updates: [update({ id: "u1", title: "old", createdAt: "2026-06-01T00:00:00.000Z" })],
      versions: [version({ sequence: 1, at: "2026-06-05T00:00:00.000Z" })],
      requests: [request({ id: "r1", type: "feature", createdAt: "2026-06-03T00:00:00.000Z" })],
    });
    expect(feed.map((e) => e.at)).toEqual([
      "2026-06-05T00:00:00.000Z",
      "2026-06-03T00:00:00.000Z",
      "2026-06-01T00:00:00.000Z",
    ]);
  });

  it("emits BOTH a submit and a state event for a request the App has acted on", () => {
    const feed = buildActivityFeed({
      updates: [],
      versions: [],
      requests: [
        request({
          id: "r1",
          type: "adjustment",
          createdAt: "2026-06-01T00:00:00.000Z",
          clientVisibleState: "completed",
          stateRevision: 3,
          stateUpdatedAt: "2026-06-04T00:00:00.000Z",
        }),
      ],
    });
    const requestEvents = feed.filter((e) => e.kind === "request");
    expect(requestEvents).toHaveLength(2);
    // Newest-first: the state change leads, the submission follows.
    expect(requestEvents[0]).toMatchObject({ at: "2026-06-04T00:00:00.000Z", detail: "Completed" });
    expect(requestEvents[1]).toMatchObject({ at: "2026-06-01T00:00:00.000Z", detail: "Submitted" });
    // Distinct stable ids.
    expect(new Set(requestEvents.map((e) => e.id)).size).toBe(2);
  });

  it("emits only a submit event for a request with no App-pushed state yet", () => {
    const feed = buildActivityFeed({
      updates: [],
      versions: [],
      requests: [request({ id: "r1", type: "support", createdAt: "2026-06-01T00:00:00.000Z" })],
    });
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({ kind: "request", detail: "Submitted" });
  });

  it("annotates a request that references a version", () => {
    const feed = buildActivityFeed({
      updates: [],
      versions: [],
      requests: [request({ id: "r1", type: "rollback", versionRef: 4, createdAt: "2026-06-01T00:00:00.000Z" })],
    });
    expect(feed[0].detail).toBe("Submitted · re: version 4");
  });

  it("carries the workspace update's material link through as the event href", () => {
    const feed = buildActivityFeed({
      updates: [update({ id: "u1", title: "Brand kit", updateType: "material", materialUrl: "https://m/1", createdAt: "2026-06-01T00:00:00.000Z" })],
      versions: [],
      requests: [],
    });
    expect(feed[0]).toMatchObject({ kind: "update", tag: "Material", href: "https://m/1" });
  });
});
