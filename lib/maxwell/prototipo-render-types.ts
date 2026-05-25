/**
 * lib/maxwell/prototipo-render-types.ts
 *
 * Wire types and error taxonomy for the prototipo render-read fetch
 * (Pull B.2 of the D-slice, per ADR-024 — GET signed-read cross-repo contract,
 * signed 2026-05-25). Companion to `prototipo-decision-types.ts` which covers
 * the POST decision side (ADR-023).
 *
 * The route `/maxwell/prototipo/[token]` server-side fetches via
 * `fetchPrototipoRender(token)` at render time. App returns the workspace +
 * lead context + prototype artifact + current decision state + lifecycle
 * metadata. The UX state mapper (`mapRenderResultToUxState`) folds the
 * combination of HTTP status, decision status, and artifact availability
 * into a single discriminated union the route file pattern-matches on.
 *
 * The signing input for the GET is the empty-body convention
 * `${unix_timestamp}.` (trailing dot, empty body) per ADR-024 D1. The error
 * codes here mirror the App-side `PROTOTYPE_READ_*` taxonomy.
 */

/**
 * The 200 success body returned by App's signed-read handler. Fully typed
 * per the handoff doc §2.5; sanitization App-side guarantees the nullability
 * rules below (e.g., `decision.notes` is only non-null when `status === 'rejected'`).
 */
export type PrototipoRenderData = {
  workspace: {
    id: string;
    version: number;
    generatedAt: string;
  };
  leadContext: {
    businessName: string;
    projectTypeLabel: string;
  };
  prototype: {
    deployedUrl: string | null;
    generatedHtml: string | null;
  };
  decision: {
    status: "pending" | "accepted" | "rejected";
    notes: string | null;
    decidedAt: string | null;
  };
  lifecycle: {
    tokenSuperseded: boolean;
    iterationNumber: number;
  };
  serverTime: string;
};

/**
 * Render-side error taxonomy per ADR-024 + handoff §2.6-§2.11. Distinct from
 * the `PROTOTIPO_DECISION_ERROR_CODES` set (POST-side has `PROTOTYPE_DECISION_*`,
 * GET-side has `PROTOTYPE_READ_*` plus the shared auth/rate-limit codes).
 */
export const PROTOTIPO_RENDER_ERROR_CODES = {
  TOKEN_NOT_FOUND: "PROTOTYPE_READ_TOKEN_NOT_FOUND",
  TOKEN_SUPERSEDED: "PROTOTYPE_READ_TOKEN_SUPERSEDED",
  LEAD_DELETED: "PROTOTYPE_READ_LEAD_DELETED",
  INTERNAL_FAILED: "PROTOTYPE_READ_INTERNAL_FAILED",
  AUTH_FAILED: "WEBSITE_WEBHOOK_AUTH_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  UNKNOWN: "UNKNOWN_ERROR",
} as const;

export type PrototipoRenderErrorCode =
  (typeof PROTOTIPO_RENDER_ERROR_CODES)[keyof typeof PROTOTIPO_RENDER_ERROR_CODES];

/**
 * Discriminated union returned by `fetchPrototipoRender`. The `ok` variant
 * carries the parsed data plus the App-side request ID (for cross-repo log
 * correlation) and the upstream `cache-control` header value so the route
 * file can mirror App's intent into the Next response.
 */
export type FetchPrototipoRenderResult =
  | {
      status: "ok";
      data: PrototipoRenderData;
      requestId: string | null;
      cacheControl: string | null;
    }
  | {
      status: "error";
      code: PrototipoRenderErrorCode;
      httpStatus: number;
      message: string;
      requestId: string | null;
    };

/**
 * UX buckets the route renders. Reduced from the wire-level codes to the set
 * the UI cares about (copy + retry hint + read/write mode). Centralising this
 * here keeps the route file declarative — snapshot tests assert against the
 * bucket, not the underlying HTTP status.
 *
 * `ready.*` variants carry the data envelope so the iframe/banner components
 * can render from a single source. `terminal.*` and `expired.*` variants do
 * not retry. `transient.*` may retry (network blip, 5xx, rate limit window).
 */
export type PrototipoRenderUxState =
  | { kind: "ready.pending"; data: PrototipoRenderData }
  | { kind: "ready.accepted"; data: PrototipoRenderData }
  | { kind: "ready.rejected"; data: PrototipoRenderData }
  | { kind: "ready.preparing"; data: PrototipoRenderData }
  | { kind: "terminal.invalid-link" }
  | { kind: "expired.regenerated" }
  | { kind: "expired.lead-deleted" }
  | { kind: "transient.auth-failed" }
  | { kind: "transient.rate-limited" }
  | { kind: "transient.internal-failed" }
  | { kind: "fatal.unknown"; httpStatus: number };

/**
 * Map a fetch result → UX state. Pure function — easy to test against a
 * fixture matrix without HTTP plumbing.
 *
 * The `ready.preparing` bucket triggers when the artifact is not yet
 * available (`deployedUrl` AND `generatedHtml` are both null) AND the
 * decision is still pending. Per handoff §2.5 this is the "preparando tu
 * prototipo" state — App's build pipeline is still running.
 */
export function mapRenderResultToUxState(
  result: FetchPrototipoRenderResult,
): PrototipoRenderUxState {
  if (result.status === "ok") {
    const { decision, prototype } = result.data;
    if (decision.status === "accepted") return { kind: "ready.accepted", data: result.data };
    if (decision.status === "rejected") return { kind: "ready.rejected", data: result.data };
    // status === "pending"
    const artifactReady = Boolean(prototype.deployedUrl) || Boolean(prototype.generatedHtml);
    return artifactReady
      ? { kind: "ready.pending", data: result.data }
      : { kind: "ready.preparing", data: result.data };
  }

  switch (result.code) {
    case PROTOTIPO_RENDER_ERROR_CODES.TOKEN_NOT_FOUND:
      return { kind: "terminal.invalid-link" };
    case PROTOTIPO_RENDER_ERROR_CODES.TOKEN_SUPERSEDED:
      return { kind: "expired.regenerated" };
    case PROTOTIPO_RENDER_ERROR_CODES.LEAD_DELETED:
      return { kind: "expired.lead-deleted" };
    case PROTOTIPO_RENDER_ERROR_CODES.AUTH_FAILED:
      return { kind: "transient.auth-failed" };
    case PROTOTIPO_RENDER_ERROR_CODES.RATE_LIMITED:
      return { kind: "transient.rate-limited" };
    case PROTOTIPO_RENDER_ERROR_CODES.INTERNAL_FAILED:
      return { kind: "transient.internal-failed" };
    case PROTOTIPO_RENDER_ERROR_CODES.UNKNOWN:
    default:
      return { kind: "fatal.unknown", httpStatus: result.httpStatus };
  }
}
