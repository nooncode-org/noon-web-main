/**
 * lib/maxwell/activity-feed.ts
 *
 * v3 §22.2 — the client-visible status/activity feed. SYNTHESIZED from data
 * NoonWeb already holds, so it ships without a new App contract:
 *   - Noon-posted workspace updates (already fetched clientVisibleOnly),
 *   - version lifecycle from the App project-status pull (`versions[]`),
 *   - client requests: submission + the App-pushed client-visible state change.
 *
 * Client-visible by construction (§22 isolation): every input is already
 * client-safe — the pull is a Zod allowlist, `client_request` carries only
 * client-owned content + the App-collapsed client-visible state, and updates are
 * read `clientVisibleOnly`. NoonWeb never holds seller comp / dev earnings /
 * margin / internal notes, so none can leak here.
 *
 * App-internal activity (e.g. "developer started work") is intentionally ABSENT
 * until the App exposes a client-activity endpoint (Phase 6a full form); this
 * feed degrades to fold those in additively when it lands.
 *
 * Pure module (type-only repo imports + pure label maps) — no DB, no server-only
 * imports — so it is safe to unit-test and to share with a future client view.
 */

import type {
  ClientRequest,
  WorkspaceUpdate,
  WorkspaceUpdateType,
} from "./repositories";
import type { ProjectStatusVersion } from "./project-status-types";
import { CLIENT_REQUEST_TYPE_LABELS, clientVisibleStateLabel } from "./client-requests";
import { mapVersionStateToMeta } from "./version-status-labels";

export type ActivityEventKind = "update" | "version" | "request";

export type ActivityEvent = {
  /** Stable React key, unique within a feed. */
  id: string;
  kind: ActivityEventKind;
  /** Short uppercase chip (the update type, or "Version" / "Request"). */
  tag: string;
  /** ISO timestamp the event happened at (the feed is sorted by this). */
  at: string;
  /** Client-facing one-line title. */
  title: string;
  /** Optional secondary line (state, content). */
  detail: string | null;
  /** Optional external link (e.g. a version preview / material URL). */
  href: string | null;
};

/** Chip copy for the non-material workspace-update types that reach the feed. */
const WORKSPACE_UPDATE_TAG: Record<WorkspaceUpdateType, string> = {
  status_update: "Update",
  milestone: "Milestone",
  material: "Material",
  note: "Note",
};

function timeValue(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Build the unified, newest-first client-visible activity feed. Inputs are the
 * data the workspace page already has; pass the NON-material updates (materials
 * have their own section). Ties on timestamp keep a stable order by source.
 */
export function buildActivityFeed(input: {
  updates: WorkspaceUpdate[];
  versions: ProjectStatusVersion[];
  requests: ClientRequest[];
}): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  // 1) Noon-posted workspace updates (already client-visible).
  for (const u of input.updates) {
    events.push({
      id: `update:${u.id}`,
      kind: "update",
      tag: WORKSPACE_UPDATE_TAG[u.updateType] ?? "Update",
      at: u.createdAt,
      title: u.title,
      detail: u.content,
      href: u.materialUrl ?? null,
    });
  }

  // 2) Version lifecycle from the App pull.
  for (const v of input.versions) {
    const meta = mapVersionStateToMeta(v.state);
    events.push({
      id: `version:${v.sequence}`,
      kind: "version",
      tag: "Version",
      at: v.at,
      title: `Version ${v.sequence}`,
      detail: meta.label,
      href: v.previewUrl,
    });
  }

  // 3) Client requests: the submission, plus the latest App-pushed state (if any).
  for (const r of input.requests) {
    const typeLabel = CLIENT_REQUEST_TYPE_LABELS[r.type];
    events.push({
      id: `request:${r.id}:submitted`,
      kind: "request",
      tag: "Request",
      at: r.createdAt,
      // Distinct from the state event below so the two don't read as duplicate
      // "Request: {type}" rows (the chip already says "Request"). The submission
      // carries only the optional version reference as its detail.
      title: `Request submitted: ${typeLabel}`,
      detail: r.versionRef != null ? `re: version ${r.versionRef}` : null,
      href: null,
    });
    if (r.clientVisibleState && r.stateUpdatedAt) {
      events.push({
        id: `request:${r.id}:state:${r.stateRevision}`,
        kind: "request",
        tag: "Request",
        at: r.stateUpdatedAt,
        // The App-pushed status change; the state label is the detail.
        title: `Request updated: ${typeLabel}`,
        detail: clientVisibleStateLabel(r.clientVisibleState),
        href: null,
      });
    }
  }

  return events.sort((a, b) => timeValue(b.at) - timeValue(a.at));
}
