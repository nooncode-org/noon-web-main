/**
 * tests/maxwell/workspace-thread.test.ts
 *
 * The client portal collapsed four surfaces (Messages, Support requests,
 * Materials, Activity) into ONE chat. This merge is the whole reason that works,
 * and there is no local database to try it against — so it is verified here.
 */

import { describe, expect, it } from "vitest";
import {
  buildWorkspaceThread,
  toChipPriority,
  toChipStatus,
} from "@/lib/maxwell/workspace-thread";
import type {
  ClientComment,
  ClientRequestWithUpdates,
  WorkspaceUpdate,
} from "@/lib/maxwell/repositories";

const stamp = (iso: string) => `@${iso.slice(11, 16)}`;

function comment(id: string, at: string, body = `comment ${id}`): ClientComment {
  return {
    id,
    clientWorkspaceId: "ws1",
    body,
    externalCommentId: id,
    noonAppCommentId: null,
    forwardedAt: null,
    createdAt: at,
  };
}

function update(id: string, at: string, over: Partial<WorkspaceUpdate> = {}): WorkspaceUpdate {
  return {
    id,
    clientWorkspaceId: "ws1",
    title: `title ${id}`,
    content: null,
    updateType: "status_update",
    materialUrl: null,
    isClientVisible: true,
    createdBy: "team",
    createdAt: at,
    ...over,
  };
}

function request(
  id: string,
  at: string,
  over: Partial<ClientRequestWithUpdates> = {},
): ClientRequestWithUpdates {
  return {
    id,
    clientWorkspaceId: "ws1",
    type: "adjustment",
    clientPriority: "normal",
    body: `request ${id}`,
    versionRef: null,
    submittedBy: "opaque",
    externalRequestId: id,
    forwardedAt: null,
    clientVisibleState: null,
    stateRevision: 0,
    stateUpdatedAt: null,
    createdAt: at,
    updates: [],
    ...over,
  };
}

const build = (args: Partial<Parameters<typeof buildWorkspaceThread>[0]> = {}) =>
  buildWorkspaceThread({
    comments: [],
    updates: [],
    materials: [],
    requests: [],
    formatStamp: stamp,
    ...args,
  });

describe("buildWorkspaceThread", () => {
  it("interleaves every channel strictly by time, not by source", () => {
    const thread = build({
      comments: [comment("c1", "2026-07-20T10:00:00.000Z")],
      updates: [update("u1", "2026-07-20T09:00:00.000Z")],
      materials: [update("m1", "2026-07-20T12:00:00.000Z", { updateType: "material" })],
      requests: [request("r1", "2026-07-20T11:00:00.000Z")],
    });

    // Sources were passed out of order on purpose — the merge must not preserve
    // per-source grouping.
    expect(thread.map((m) => m.id)).toEqual(["u-u1", "c-c1", "r-r1", "m-m1"]);
  });

  it("keeps a request's replies after it, in order", () => {
    const thread = build({
      requests: [
        request("r1", "2026-07-20T10:00:00.000Z", {
          updates: [
            {
              id: "up2",
              clientRequestId: "r1",
              kind: "clarification",
              body: "second",
              externalUpdateId: "up2",
              forwardedAt: null,
              createdAt: "2026-07-20T12:00:00.000Z",
            },
            {
              id: "up1",
              clientRequestId: "r1",
              kind: "clarification",
              body: "first",
              externalUpdateId: "up1",
              forwardedAt: null,
              createdAt: "2026-07-20T11:00:00.000Z",
            },
          ],
        }),
      ],
    });

    expect(thread.map((m) => m.id)).toEqual(["r-r1", "ru-up1", "ru-up2"]);
    expect(thread.map((m) => m.text)).toEqual(["request r1", "first", "second"]);
  });

  it("ids are namespaced per source so same-id rows never collide", () => {
    const thread = build({
      comments: [comment("1", "2026-07-20T10:00:00.000Z")],
      updates: [update("1", "2026-07-20T10:00:01.000Z")],
      requests: [request("1", "2026-07-20T10:00:02.000Z")],
    });

    const ids = thread.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["c-1", "u-1", "r-1"]);
  });

  it("attributes sides correctly: the client's own vs Noon's", () => {
    const thread = build({
      comments: [comment("c1", "2026-07-20T10:00:00.000Z")],
      updates: [update("u1", "2026-07-20T10:00:01.000Z")],
      requests: [request("r1", "2026-07-20T10:00:02.000Z")],
    });

    // A request is something the CLIENT sent — it must not read as Noon talking.
    expect(thread.map((m) => m.from)).toEqual(["client", "dev", "client"]);
  });

  it("only a tracked request carries a chip + the id that enables Reply", () => {
    const thread = build({
      comments: [comment("c1", "2026-07-20T10:00:00.000Z")],
      requests: [
        request("r1", "2026-07-20T10:00:01.000Z", {
          type: "bug",
          clientPriority: "critical",
          clientVisibleState: "in_progress",
        }),
      ],
    });

    const [plain, tracked] = thread;
    expect(plain.request).toBeUndefined();
    expect(plain.requestId).toBeUndefined();
    expect(tracked.requestId).toBe("r1");
    expect(tracked.request).toEqual({
      label: "Bug / problem",
      priority: "High",
      status: "in_progress",
    });
  });

  it("a material becomes an openable chip; a note-only update does not", () => {
    const thread = build({
      materials: [
        update("m1", "2026-07-20T10:00:00.000Z", {
          updateType: "material",
          title: "brand-kit.zip",
          materialUrl: "https://files.example/brand-kit.zip",
        }),
        update("m2", "2026-07-20T10:00:01.000Z", { updateType: "material", materialUrl: null }),
      ],
    });

    expect(thread[0].attachment).toEqual({
      name: "brand-kit.zip",
      href: "https://files.example/brand-kit.zip",
    });
    expect(thread[1].attachment).toBeUndefined();
  });

  it("an update's title and body are both shown, never silently dropped", () => {
    const thread = build({
      updates: [
        update("u1", "2026-07-20T10:00:00.000Z", { title: "v2 shipped", content: "Dark mode." }),
        update("u2", "2026-07-20T10:00:01.000Z", { title: "Only a title", content: null }),
      ],
    });

    expect(thread[0].text).toBe("v2 shipped\nDark mode.");
    expect(thread[1].text).toBe("Only a title");
  });

  it("renders stamps through the caller's formatter", () => {
    const thread = build({ comments: [comment("c1", "2026-07-20T14:35:00.000Z")] });
    expect(thread[0].at).toBe("@14:35");
  });

  it("an empty portal produces an empty thread, not a placeholder", () => {
    expect(build()).toEqual([]);
  });
});

describe("chip mapping", () => {
  it("collapses every mid-flight state to 'in progress'", () => {
    expect(toChipStatus("in_review")).toBe("in_progress");
    expect(toChipStatus("in_progress")).toBe("in_progress");
    expect(toChipStatus("under_internal_review")).toBe("in_progress");
  });

  it("maps the endpoints, and treats an un-pushed request as received", () => {
    expect(toChipStatus("completed")).toBe("done");
    expect(toChipStatus("received")).toBe("received");
    expect(toChipStatus(null)).toBe("received");
  });

  it("folds critical into High so urgency is never lost", () => {
    expect(toChipPriority("critical")).toBe("High");
    expect(toChipPriority("high")).toBe("High");
    expect(toChipPriority("normal")).toBe("Normal");
    expect(toChipPriority("low")).toBe("Low");
  });
});
