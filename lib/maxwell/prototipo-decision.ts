/**
 * lib/maxwell/prototipo-decision.ts
 *
 * `submitPrototipoDecision` — Web → App outbound webhook for client decisions
 * captured on `/maxwell/prototipo/[token]`. Per ADR-023 §D6 the synchronous
 * path of the cross-repo flow:
 *
 *   1. Build payload per §D2 (both token AND prototype_workspace_id).
 *   2. Sign with the shared HMAC secret via `postNoonAppWebhook`.
 *   3. POST to App's `/api/integrations/website/prototype-decision`.
 *   4. Map App's structured response (`{ ok, idempotent }` or `{ error, code }`)
 *      into a `SubmitPrototipoDecisionResult` discriminated union.
 *
 * Retry policy is inherited from `postNoonAppWebhook`: 3 attempts total, 1s + 2s
 * backoff with ±20% jitter, retry on 5xx + network errors, do not retry on 4xx.
 * This satisfies the §D6 "idempotent retry on 5xx" requirement from the D-slice
 * deliverable description.
 *
 * Transport-level idempotency is the App's responsibility per ADR-023 §D1: the
 * server resolves `(endpoint, signature_hash)` against `website_webhook_events`
 * and returns the original wire response on bit-identical replays. Web does NOT
 * send a `decision_id` or `Idempotency-Key` — explicitly forbidden by §D1.
 */

import { NoonAppIntegrationError, postNoonAppWebhook } from "@/lib/noon-app-integration";
import {
  PROTOTIPO_DECISION_ERROR_CODES,
  type PrototipoDecisionErrorCode,
  type PrototipoDecisionPayload,
  type SubmitPrototipoDecisionResult,
} from "./prototipo-decision-types";

const PROTOTIPO_DECISION_PATH = "/api/integrations/website/prototype-decision";

/**
 * Map an HTTP status + optional structured code from App into a `PrototipoDecisionErrorCode`.
 *
 * App's response envelope per cross-repo-webhook-v1 §6 carries the code as a
 * field on the body: `{ error, code, requestId }`. When the body is missing or
 * the code is unrecognised, we fall back to status-based bucketing so the UI
 * still has something deterministic to render. The `UNKNOWN_ERROR` bucket is
 * the safety valve.
 */
function classifyError(httpStatus: number, rawCode: string | undefined): PrototipoDecisionErrorCode {
  if (rawCode) {
    const known = (Object.values(PROTOTIPO_DECISION_ERROR_CODES) as string[]).includes(rawCode);
    if (known) return rawCode as PrototipoDecisionErrorCode;
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return PROTOTIPO_DECISION_ERROR_CODES.AUTH_FAILED;
  }
  if (httpStatus === 429) {
    return PROTOTIPO_DECISION_ERROR_CODES.RATE_LIMITED;
  }
  if (httpStatus >= 500) {
    return PROTOTIPO_DECISION_ERROR_CODES.PERSIST_FAILED;
  }
  return PROTOTIPO_DECISION_ERROR_CODES.UNKNOWN;
}

/**
 * Best-effort JSON parse of an error message text body. App's response envelope
 * is JSON-shaped, but defensive parsing means a malformed body just falls through
 * to the status-based classifier.
 */
function parseErrorBody(text: string): { code?: string; requestId?: string; error?: string } {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      code: typeof parsed.code === "string" ? parsed.code : undefined,
      requestId: typeof parsed.requestId === "string" ? parsed.requestId : undefined,
      error: typeof parsed.error === "string" ? parsed.error : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Parse a successful App response into the `isReplay` flag.
 *
 * App returns either `{ ok: true, idempotent: false }` (first hit) or
 * `{ ok: true, idempotent: true }` (bit-identical replay). On any unexpected
 * shape we default `isReplay: false` so the UI shows a fresh confirmation —
 * the worst case is a stale "thank you" page on a replay edge case, which is
 * a strictly better failure mode than a "this is a replay" message on a
 * first-and-only successful decision.
 */
function parseSuccessBody(value: unknown): { isReplay: boolean } {
  if (value && typeof value === "object" && "idempotent" in value) {
    return { isReplay: (value as { idempotent: unknown }).idempotent === true };
  }
  return { isReplay: false };
}

export type SubmitPrototipoDecisionInput = {
  token: string;
  prototypeWorkspaceId: string;
  decision: "accepted" | "rejected";
  notes?: string;
  clientUserAgent?: string;
};

export async function submitPrototipoDecision(
  input: SubmitPrototipoDecisionInput,
): Promise<SubmitPrototipoDecisionResult> {
  const payload: PrototipoDecisionPayload = {
    token: input.token,
    prototype_workspace_id: input.prototypeWorkspaceId,
    decision: input.decision,
    ...(input.notes && input.notes.trim() ? { notes: input.notes.trim() } : {}),
    ...(input.clientUserAgent ? { client_user_agent: input.clientUserAgent } : {}),
  };

  try {
    const responseValue = await postNoonAppWebhook(PROTOTIPO_DECISION_PATH, payload);
    const { isReplay } = parseSuccessBody(responseValue);
    return { status: "ok", isReplay };
  } catch (error) {
    if (error instanceof NoonAppIntegrationError) {
      const parsed = parseErrorBody(error.message);
      return {
        status: "error",
        code: classifyError(error.status, parsed.code),
        httpStatus: error.status,
        message: parsed.error ?? error.message,
        ...(parsed.requestId ? { requestId: parsed.requestId } : {}),
      };
    }
    // Network / unexpected — treat as transient infra failure surfacing the
    // PERSIST_FAILED bucket so the UI shows the retry copy. We do not retry
    // here a fourth time on top of `postNoonAppWebhook`'s 3-attempt loop.
    const message = error instanceof Error ? error.message : "Unknown network failure";
    return {
      status: "error",
      code: PROTOTIPO_DECISION_ERROR_CODES.PERSIST_FAILED,
      httpStatus: 0,
      message,
    };
  }
}
