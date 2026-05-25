/**
 * lib/maxwell/prototipo-decision-types.ts
 *
 * Wire types and error taxonomy for the prototipo-decision cross-repo webhook,
 * per ADR-023 (App-nooncode/docs/adrs/ADR-023-prototype-decision-cross-repo-contract.md).
 *
 * The decision is captured client-side on `/maxwell/prototipo/[token]` and POSTed
 * to App's `/api/integrations/website/prototype-decision`. App authoritatively
 * resolves the token, validates lifecycle state, persists into `prototype_decisions`,
 * and fires the post-accept Maxwell draft as a fire-and-forget background task.
 *
 * No payload-level idempotency is invented per ADR-023 §D1 — the transport ledger
 * is the single idempotency layer (identity key `(endpoint, signature_hash)`).
 */

/**
 * Outbound payload Web sends to App.
 *
 * Both `token` (opaque, App-issued) and `prototype_workspace_id` are carried per
 * ADR-023 §D2. Token is the authoritative resolution key server-side;
 * `prototype_workspace_id` is the defensive cross-check against stale render-cache
 * bugs (mismatch returns 409 `PROTOTYPE_DECISION_IDENTIFIER_MISMATCH`).
 */
export type PrototipoDecisionPayload = {
  token: string;
  prototype_workspace_id: string;
  decision: "accepted" | "rejected";
  notes?: string;
  client_user_agent?: string;
};

/**
 * Prototipo-specific error codes per ADR-023 §D5. The integer status reflects the
 * HTTP code App returns. The string `code` is what the UX state mapper switches on
 * — copy is owned by the UI layer, not this type.
 */
export const PROTOTIPO_DECISION_ERROR_CODES = {
  TOKEN_NOT_FOUND: "PROTOTYPE_DECISION_TOKEN_NOT_FOUND",
  ALREADY_DECIDED: "PROTOTYPE_DECISION_ALREADY_DECIDED",
  IDENTIFIER_MISMATCH: "PROTOTYPE_DECISION_IDENTIFIER_MISMATCH",
  TOKEN_EXPIRED: "PROTOTYPE_DECISION_TOKEN_EXPIRED",
  LEAD_DELETED: "PROTOTYPE_DECISION_LEAD_DELETED",
  INVALID_DECISION: "PROTOTYPE_DECISION_INVALID_DECISION",
  PERSIST_FAILED: "PROTOTYPE_DECISION_PERSIST_FAILED",
  AUTH_FAILED: "WEBSITE_WEBHOOK_AUTH_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  UNKNOWN: "UNKNOWN_ERROR",
} as const;

export type PrototipoDecisionErrorCode =
  (typeof PROTOTIPO_DECISION_ERROR_CODES)[keyof typeof PROTOTIPO_DECISION_ERROR_CODES];

/**
 * Shape App's response envelope follows for both success and failure.
 *
 * Success body example: `{ ok: true, idempotent: false }` or with replay
 * `{ ok: true, idempotent: true }`.
 *
 * Failure body example: `{ error: "Already decided", code: "PROTOTYPE_DECISION_ALREADY_DECIDED", requestId: "..." }`.
 * The `code` field is what we switch on in the UX mapper.
 */
export type AppResponseEnvelope =
  | { ok: true; idempotent?: boolean; [key: string]: unknown }
  | { error: string; code?: string; requestId?: string; [key: string]: unknown };

/**
 * Result returned by `submitPrototipoDecision`. Discriminated union — the UI
 * layer pattern-matches on `status` and renders the right state per ADR-023 §D5.
 *
 * `ok` results may carry `isReplay: true` when the call was a transport-ledger
 * replay; the UI may render a "we already recorded your decision" confirmation
 * without re-firing notifications (the original notification already happened).
 *
 * `error` results carry the structured code so the UI mapper does not have to
 * parse HTTP status — that mapping is centralised in this helper.
 */
export type SubmitPrototipoDecisionResult =
  | { status: "ok"; isReplay: boolean }
  | {
      status: "error";
      code: PrototipoDecisionErrorCode;
      httpStatus: number;
      message: string;
      requestId?: string;
    };

/**
 * UX classes the route maps to. Mirrors ADR-023 §D5 but reduced to the buckets
 * the UI cares about (copy + retry hint), not the wire-level codes.
 *
 * Centralising this here keeps the route file readable and means snapshot tests
 * can assert against the bucket, not the underlying code.
 */
export type PrototipoDecisionUxState =
  | { kind: "confirmed.accepted" }
  | { kind: "confirmed.rejected" }
  | { kind: "already-decided.read-only" }
  | { kind: "terminal.invalid-link" }
  | { kind: "terminal.identifier-mismatch" }
  | { kind: "expired.regenerated" }
  | { kind: "expired.lead-deleted" }
  | { kind: "transient.persist-failed"; canRetry: boolean }
  | { kind: "transient.rate-limited" }
  | { kind: "fatal.unknown"; httpStatus: number };

/**
 * Map (status, code) → UX state. Pure function — easy to test against a fixture
 * matrix without HTTP plumbing.
 */
export function mapResultToUxState(
  result: SubmitPrototipoDecisionResult,
  decision: "accepted" | "rejected",
): PrototipoDecisionUxState {
  if (result.status === "ok") {
    if (result.isReplay) return { kind: "already-decided.read-only" };
    return decision === "accepted"
      ? { kind: "confirmed.accepted" }
      : { kind: "confirmed.rejected" };
  }

  switch (result.code) {
    case PROTOTIPO_DECISION_ERROR_CODES.TOKEN_NOT_FOUND:
      return { kind: "terminal.invalid-link" };
    case PROTOTIPO_DECISION_ERROR_CODES.ALREADY_DECIDED:
      return { kind: "already-decided.read-only" };
    case PROTOTIPO_DECISION_ERROR_CODES.IDENTIFIER_MISMATCH:
      return { kind: "terminal.identifier-mismatch" };
    case PROTOTIPO_DECISION_ERROR_CODES.TOKEN_EXPIRED:
      return { kind: "expired.regenerated" };
    case PROTOTIPO_DECISION_ERROR_CODES.LEAD_DELETED:
      return { kind: "expired.lead-deleted" };
    case PROTOTIPO_DECISION_ERROR_CODES.PERSIST_FAILED:
      return { kind: "transient.persist-failed", canRetry: true };
    case PROTOTIPO_DECISION_ERROR_CODES.RATE_LIMITED:
      return { kind: "transient.rate-limited" };
    case PROTOTIPO_DECISION_ERROR_CODES.INVALID_DECISION:
    case PROTOTIPO_DECISION_ERROR_CODES.AUTH_FAILED:
    case PROTOTIPO_DECISION_ERROR_CODES.UNKNOWN:
    default:
      return { kind: "fatal.unknown", httpStatus: result.httpStatus };
  }
}
