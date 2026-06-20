/**
 * lib/maxwell/client-requests.ts
 *
 * Shared vocabulary + UI copy for the v3 client-request system (§9), web side.
 *
 * Pure module: const enums, Zod schemas, label maps, and string guards ONLY —
 * no server-only imports (no node:crypto, no DB), so it is safe to import from
 * client components (the typed submission form) as well as server code. The
 * HMAC-derived `submittedBy` lives in lib/noon-app-integration.ts (server) so
 * the secret never reaches the client bundle.
 *
 * The wire vocabularies are FROZEN cross-repo (see
 * docs/v3-client-requests-noonweb-design.md §1 + the co-design handoffs) and are
 * declared identically on the App side. snake_case on the wire.
 */

import { z } from "zod";

/**
 * The 10 canonical request types (wire = snake_case). 1:1 with master-spec §9.1.
 *
 * `rollback` (B.4, co-signed 2026-06-20) is the 10th: a client asking staff to
 * revert to an earlier version. It is *suggest-not-force* — the App accepts the
 * request and staff decide+execute (rollback is staff authority). It REQUIRES a
 * `versionRef` (enforced in the server action); the other 9 leave it optional.
 * It is NOT a generic dropdown choice — see {@link SELECTABLE_CLIENT_REQUEST_TYPES}
 * — and is gated by {@link ROLLBACK_REQUEST_ENABLED} until the App deploys it.
 */
export const CLIENT_REQUEST_TYPES = [
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
] as const;
export type ClientRequestType = (typeof CLIENT_REQUEST_TYPES)[number];

/**
 * Types the client may pick from the generic request form. `rollback` is
 * EXCLUDED: it is initiated only from a version row (it requires a `versionRef`,
 * which the row supplies) and is gated by {@link ROLLBACK_REQUEST_ENABLED}.
 */
export const SELECTABLE_CLIENT_REQUEST_TYPES: readonly ClientRequestType[] =
  CLIENT_REQUEST_TYPES.filter((type) => type !== "rollback");

/**
 * B.4 rollback-path gate (hard deploy order, cosign §4). ENABLED 2026-06-20: the
 * App deployed its `type = rollback` CHECK (migration 0094, ADR-041) + the inbound
 * receiver's `versionRef`-required refine, and NoonWeb applied the symmetric
 * migration 026 — so the full rollback path (version-row button + server action)
 * is live. The REFERENCE path (a `versionRef` on the existing 9 types) never
 * depended on this.
 *
 * Kept as a flag (not deleted) so the path can be disabled fast if needed: while
 * `false` the rollback button hides and the server action rejects `type = rollback`.
 *
 * Typed `boolean` (not a literal) on purpose: conditions reading it must not be
 * treated as statically known/unreachable.
 */
export const ROLLBACK_REQUEST_ENABLED: boolean = true;

/**
 * The 5 client-DECLARED priorities (§9.6). Informational only: the OPERATIONAL
 * priority is decided by Noon on the App side and never crosses the wire.
 */
export const CLIENT_REQUEST_PRIORITIES = [
  "critical",
  "high",
  "normal",
  "low",
  "backlog",
] as const;
export type ClientRequestPriority = (typeof CLIENT_REQUEST_PRIORITIES)[number];

/**
 * The 5 client-visible states the App may project back. The App collapses its 8
 * operational states to these 5 server-side (escalated -> under_internal_review);
 * the operational states never cross the wire (§8.3).
 */
export const CLIENT_VISIBLE_STATES = [
  "received",
  "in_review",
  "in_progress",
  "completed",
  "under_internal_review",
] as const;
export type ClientVisibleState = (typeof CLIENT_VISIBLE_STATES)[number];

export const CLIENT_REQUEST_BODY_MIN = 1;
export const CLIENT_REQUEST_BODY_MAX = 4000;

/**
 * Bounds for the optional `versionRef` link (B.4). `versionRef == the App's
 * `versionSequenceNumber` (same id as Fase 2 Publish). The cap mirrors the App's
 * server-side backstop so a malformed ref is caught client-side with a clean
 * error before the forward.
 */
export const VERSION_REF_MIN = 1;
export const VERSION_REF_MAX = 100000;

/** Shape guard for a request's optional version link; mirrors the App backstop. */
export function isValidVersionRef(value: number): boolean {
  return Number.isInteger(value) && value >= VERSION_REF_MIN && value <= VERSION_REF_MAX;
}

export const clientRequestTypeSchema = z.enum(CLIENT_REQUEST_TYPES);
export const clientRequestPrioritySchema = z.enum(CLIENT_REQUEST_PRIORITIES);
export const clientVisibleStateSchema = z.enum(CLIENT_VISIBLE_STATES);

/** UI copy for the type selector (the portal owns the human labels, §8.1). */
export const CLIENT_REQUEST_TYPE_LABELS: Record<ClientRequestType, string> = {
  material: "Material / file",
  comment: "Comment",
  bug: "Bug / problem",
  adjustment: "Minor adjustment",
  support: "Support",
  improvement: "Improvement",
  feature: "New feature",
  scope_change: "Scope change",
  incident: "Urgent incident",
  rollback: "Rollback request",
};

export const CLIENT_REQUEST_PRIORITY_LABELS: Record<ClientRequestPriority, string> = {
  critical: "Critical",
  high: "High",
  normal: "Normal",
  low: "Low",
  backlog: "Backlog",
};

/**
 * Client-visible state -> short label. The portal owns the client-facing copy
 * (§8.1). NULL (no App push yet) renders as "Received".
 */
export const CLIENT_VISIBLE_STATE_LABELS: Record<ClientVisibleState, string> = {
  received: "Received",
  in_review: "In review",
  in_progress: "In progress",
  completed: "Completed",
  under_internal_review: "Under internal review",
};

/**
 * Client-visible state -> badge tone (Tailwind classes), mirroring the
 * workspace status badge palette. Slice B uses this to colour the request
 * status badge; combine with the label via {@link clientVisibleStateMeta}.
 */
export const CLIENT_VISIBLE_STATE_TONE: Record<ClientVisibleState, string> = {
  received: "border-border text-muted-foreground",
  in_review: "border-amber-500/25 bg-amber-500/10 text-amber-700",
  in_progress: "border-blue-500/25 bg-blue-500/10 text-blue-700",
  completed: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
  under_internal_review: "border-amber-500/25 bg-amber-500/10 text-amber-700",
};

export const DEFAULT_CLIENT_REQUEST_PRIORITY: ClientRequestPriority = "normal";

export function isClientRequestType(value: string): value is ClientRequestType {
  return (CLIENT_REQUEST_TYPES as readonly string[]).includes(value);
}

export function isClientRequestPriority(value: string): value is ClientRequestPriority {
  return (CLIENT_REQUEST_PRIORITIES as readonly string[]).includes(value);
}

/** Label for a stored client-visible state; NULL (no App push yet) -> "Received". */
export function clientVisibleStateLabel(state: ClientVisibleState | null): string {
  return CLIENT_VISIBLE_STATE_LABELS[state ?? "received"];
}

/** Label + badge tone for a stored client-visible state; NULL -> "Received". */
export function clientVisibleStateMeta(
  state: ClientVisibleState | null,
): { label: string; tone: string } {
  const resolved = state ?? "received";
  return { label: CLIENT_VISIBLE_STATE_LABELS[resolved], tone: CLIENT_VISIBLE_STATE_TONE[resolved] };
}
