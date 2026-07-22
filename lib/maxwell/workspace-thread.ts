/**
 * lib/maxwell/workspace-thread.ts
 *
 * Builds the client portal's ONE conversation with Noon out of the four real
 * channels that used to live in separate tabs: the client's messages (comments),
 * the team's updates, delivered materials, and typed requests with their
 * clarification replies (§9). Chronological, oldest first.
 *
 * Pure + server-agnostic on purpose: the workspace page renders it, and tests
 * exercise it directly — there is no DB locally, so this is the only way the
 * merge is verified before a real client ever sees it.
 */

import type {
  ClientComment,
  ClientRequestWithUpdates,
  WorkspaceUpdate,
} from "@/lib/maxwell/repositories";
import {
  CLIENT_REQUEST_TYPE_LABELS,
  type ClientRequestPriority,
  type ClientVisibleState,
} from "@/lib/maxwell/client-requests";

export type ThreadChipStatus = "received" | "in_progress" | "done";
export type ThreadChipPriority = "Low" | "Normal" | "High";

/** One rendered bubble. Mirrors `ChatMsg` in workspace-chat.tsx. */
export type ThreadMessage = {
  id: string;
  from: "client" | "maxwell" | "dev";
  devName?: string;
  text: string;
  at: string;
  attachment?: { name: string; image?: boolean; href?: string };
  request?: { label: string; priority?: ThreadChipPriority; status: ThreadChipStatus };
  requestId?: string;
};

/**
 * The App owns five client-visible states; the chat chip speaks three. Anything
 * mid-flight reads as "in progress" — the client cares that it moved, not which
 * internal queue it sits in.
 */
export function toChipStatus(state: ClientVisibleState | null): ThreadChipStatus {
  if (state === "completed") return "done";
  if (state === "in_progress" || state === "in_review" || state === "under_internal_review") {
    return "in_progress";
  }
  return "received";
}

/** Four priorities → the chip's three (critical folds into High). */
export function toChipPriority(priority: ClientRequestPriority): ThreadChipPriority {
  if (priority === "critical" || priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Normal";
}

export function buildWorkspaceThread({
  comments,
  updates,
  materials,
  requests,
  formatStamp,
}: {
  comments: ClientComment[];
  /** Team updates EXCLUDING materials (those carry their file separately). */
  updates: WorkspaceUpdate[];
  materials: WorkspaceUpdate[];
  requests: ClientRequestWithUpdates[];
  formatStamp: (iso: string | Date) => string;
}): ThreadMessage[] {
  // `at` is the raw row value: a Date from postgres.js, a string once serialized.
  const entries: { at: string | Date; msg: ThreadMessage }[] = [
    ...comments.map((c) => ({
      at: c.createdAt,
      msg: {
        id: `c-${c.id}`,
        from: "client" as const,
        text: c.body,
        at: formatStamp(c.createdAt),
      },
    })),
    ...updates.map((u) => ({
      at: u.createdAt,
      msg: {
        id: `u-${u.id}`,
        from: "dev" as const,
        text: u.content ? `${u.title}\n${u.content}` : u.title,
        at: formatStamp(u.createdAt),
      },
    })),
    ...materials.map((u) => ({
      at: u.createdAt,
      msg: {
        id: `m-${u.id}`,
        from: "dev" as const,
        text: u.content ?? u.title,
        at: formatStamp(u.createdAt),
        // The chip becomes a link when the material has a URL to open.
        attachment: u.materialUrl ? { name: u.title, href: u.materialUrl } : undefined,
      },
    })),
    // A request and its replies are separate bubbles: the request carries the
    // status chip (and its id, which enables Reply), the replies are plain.
    ...requests.flatMap((r) => [
      {
        at: r.createdAt,
        msg: {
          id: `r-${r.id}`,
          from: "client" as const,
          text: r.body,
          at: formatStamp(r.createdAt),
          requestId: r.id,
          request: {
            label: CLIENT_REQUEST_TYPE_LABELS[r.type],
            priority: toChipPriority(r.clientPriority),
            status: toChipStatus(r.clientVisibleState),
          },
        },
      },
      ...r.updates.map((u) => ({
        at: u.createdAt,
        msg: {
          id: `ru-${u.id}`,
          from: "client" as const,
          text: u.body,
          at: formatStamp(u.createdAt),
        },
      })),
    ]),
  ];

  // Timestamps arrive as Date objects from postgres.js even though the row types
  // declare `string` (they're only ISO strings once something serializes them),
  // so sort on the epoch value rather than assuming either shape.
  return entries.sort((a, b) => toMillis(a.at) - toMillis(b.at)).map((e) => e.msg);
}

function toMillis(value: string | Date): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}
