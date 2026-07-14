/**
 * lib/maxwell/prototipo-share-types.ts
 *
 * Wire types and error taxonomy for the D-upstream wire (ADR-028), the
 * Web→App POST that NoonWeb fires when the seller shares the current
 * prototipo with the client. Companion to `prototipo-share.ts` (the
 * outbound helper) and `app/[locale]/studio/_actions/share-prototype.ts`
 * (the Server Action that wraps it).
 *
 * Direction: NoonWeb → App `/api/integrations/website/prototype-share`.
 *
 * What App does with the payload (per ADR-028 D1 + D3 + Piedra's 2026-05-26
 * answers on Q-piedra-1/2/3): inserts (or returns existing) `prototype_workspaces`
 * row keyed on `(external_session_id, v0_chat_id)`, generates the opaque
 * `share_token` via `gen_random_uuid()::text` under service_role (NOT via
 * `request_lead_prototype` RPC — that RPC requires `auth.uid()` and is
 * seller-context-only), resolves the lead via `website_inbound_links` or
 * creates a fresh prospect-status lead. Returns the token, workspace id,
 * lead id, and any superseded workspace ids (regenerate semantics per
 * ADR-023 D3).
 *
 * Idempotency: transport-level via `website_webhook_events` ledger
 * `(endpoint, signature_hash)`; application-level via the
 * `(external_session_id, v0_chat_id)` resource dedup. No payload-level
 * idempotency key per ADR-016 D2 / ADR-028 D4.
 */

// ============================================================================
// Outbound payload
// ============================================================================

/**
 * The JSON body Web sends to App per ADR-028 D2.
 *
 * Field semantics:
 *  - `external_session_id` — the studio_session.id. Carries the share to App's
 *    log/trace plane; also disambiguates resource-dedup against the same V0
 *    chat being shared from a different session.
 *  - `lead.business_name` + `lead.project_type_label` — REQUIRED. App may
 *    deduplicate against an existing lead via `website_inbound_links` (Piedra
 *    Q-piedra-3 path); if no match, App creates a fresh lead at
 *    `status='prospect'` (NOT `proposal`) and skips the `lead_proposals`
 *    row entirely.
 *  - `lead.customer.*` — all optional. The share moment may precede full
 *    customer capture (the seller has chatted with Maxwell but the client
 *    hasn't signed off yet). App stores what's present; NULLs are normal.
 *  - `prototype.v0_chat_id` — REQUIRED. Together with `external_session_id`
 *    it forms the resource-dedup key. Regenerate = new chat = new share row
 *    = new token (superseding the previous).
 *  - `prototype.deployed_url` — REQUIRED `https://` URL of the V0 deploy.
 *  - `prototype.generated_html` — optional `srcdoc` fallback. If both
 *    `deployed_url` AND `generated_html` are null → App returns 400
 *    `PROTOTYPE_SHARE_INVALID_PROTOTYPE`.
 *  - `prototype.generated_at` — REQUIRED ISO 8601 of the V0 build time.
 *  - `metadata` — optional record. App preserves it but does not interpret.
 */
export type PrototipoSharePayload = {
  external_source: "noon_website";
  external_session_id: string;
  lead: {
    business_name: string;
    project_type_label: string;
    customer?: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      whatsapp?: string | null;
      company?: string | null;
    };
  };
  prototype: {
    v0_chat_id: string;
    version_number: number;
    deployed_url: string;
    generated_html?: string | null;
    generated_at: string;
  };
  metadata?: Record<string, unknown>;
};

// ============================================================================
// App response shape (success)
// ============================================================================

/**
 * Success body's `data` field per ADR-028 D3. App composes the envelope as
 * `{ data: PrototipoShareResponseData, requestId: string }` so callers can
 * pluck the request id for cross-repo log correlation without it leaking
 * into the data payload.
 *
 * `superseded_workspace_ids` is empty on V1 (first share). On regenerate
 * (V2+), it carries the prior workspace id(s) whose tokens just became
 * dead. NoonWeb does not need to act on them beyond overwriting its own
 * `studio_session.share_token` column — App owns the App-side cleanup.
 *
 * HTTP status: `201` Created on first emit, `200` OK on idempotent replay
 * (transport-level OR application-level dedup hit, signalled by
 * `idempotent: true`).
 */
export type PrototipoShareResponseData = {
  idempotent: boolean;
  share_token: string;
  prototype_workspace_id: string;
  lead_id: string;
  version_number: number;
  issued_at: string;
  superseded_workspace_ids: string[];
};

// ============================================================================
// Error taxonomy (ADR-028 D5)
// ============================================================================

/**
 * Codes the new endpoint may return. AUTH_FAILED and RATE_LIMITED are shared
 * with the other three inbound webhooks per `cross-repo-webhook-v1.md` §8;
 * the rest are namespaced `PROTOTYPE_SHARE_*`.
 *
 * App's response envelope on failure: `{ error, code, requestId }` per the
 * v1 contract §8. The mapper switches on `code`; `error` and `requestId`
 * are preserved for logging.
 */
export const PROTOTIPO_SHARE_ERROR_CODES = {
  INVALID_PROTOTYPE: "PROTOTYPE_SHARE_INVALID_PROTOTYPE",
  INVALID_LEAD: "PROTOTYPE_SHARE_INVALID_LEAD",
  WORKSPACE_TERMINAL: "PROTOTYPE_SHARE_WORKSPACE_TERMINAL",
  PERSIST_FAILED: "PROTOTYPE_SHARE_PERSIST_FAILED",
  TOKEN_GENERATION_FAILED: "PROTOTYPE_SHARE_TOKEN_GENERATION_FAILED",
  AUTH_FAILED: "WEBSITE_WEBHOOK_AUTH_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  UNKNOWN: "UNKNOWN_ERROR",
} as const;

export type PrototipoShareErrorCode =
  (typeof PROTOTIPO_SHARE_ERROR_CODES)[keyof typeof PROTOTIPO_SHARE_ERROR_CODES];

// ============================================================================
// Helper result (discriminated union)
// ============================================================================

/**
 * Output of `requestPrototipoShare`. The Server Action pattern-matches on
 * `status`; on `ok` it persists the four columns and transitions the state;
 * on `error` it maps to a UX bucket and surfaces the structured copy.
 *
 * `isReplay` mirrors App's `data.idempotent`. The Server Action treats a
 * replay the same as a first emit for persistence (same data overwrites the
 * same data; idempotent on Web side) but skips re-firing log events.
 */
export type RequestPrototipoShareResult =
  | {
      status: "ok";
      data: PrototipoShareResponseData;
      requestId: string | null;
      isReplay: boolean;
    }
  | {
      status: "error";
      code: PrototipoShareErrorCode;
      httpStatus: number;
      message: string;
      requestId?: string;
    };

// ============================================================================
// UX state (ADR-028 D8)
// ============================================================================

/**
 * UX buckets the studio CTA renders. Pre-call states (`idle` and `sharing`)
 * are managed by the client; post-call states are produced by the Server
 * Action.
 *
 * `success` carries `shareUrl` (composed Web-side via `resolvePublicBaseUrl`
 * + locale + token) so the CTA can render the copy-link button directly
 * without an extra round-trip.
 */
export type PrototipoShareUxState =
  | { kind: "idle" }
  | { kind: "sharing" }
  | {
      kind: "success";
      shareUrl: string;
      shareToken: string;
      prototypeWorkspaceId: string;
      isReplay: boolean;
    }
  | { kind: "terminal.workspace-locked" }
  | { kind: "transient.persist-failed"; canRetry: true }
  | { kind: "transient.rate-limited" }
  | { kind: "fatal.unknown"; httpStatus: number };

/**
 * Map a helper result + composed share URL → UX state.
 *
 * Pure: no I/O, no env reads. `shareUrl` is only consumed on the success
 * branch; pass an empty string when calling for an error path (the value
 * will be ignored). Tests cover the matrix.
 */
export function mapShareResultToUxState(
  result: RequestPrototipoShareResult,
  shareUrl: string,
): PrototipoShareUxState {
  if (result.status === "ok") {
    return {
      kind: "success",
      shareUrl,
      shareToken: result.data.share_token,
      prototypeWorkspaceId: result.data.prototype_workspace_id,
      isReplay: result.isReplay,
    };
  }

  switch (result.code) {
    case PROTOTIPO_SHARE_ERROR_CODES.WORKSPACE_TERMINAL:
      return { kind: "terminal.workspace-locked" };
    case PROTOTIPO_SHARE_ERROR_CODES.PERSIST_FAILED:
    case PROTOTIPO_SHARE_ERROR_CODES.TOKEN_GENERATION_FAILED:
      return { kind: "transient.persist-failed", canRetry: true };
    case PROTOTIPO_SHARE_ERROR_CODES.RATE_LIMITED:
      return { kind: "transient.rate-limited" };
    case PROTOTIPO_SHARE_ERROR_CODES.INVALID_PROTOTYPE:
    case PROTOTIPO_SHARE_ERROR_CODES.INVALID_LEAD:
    case PROTOTIPO_SHARE_ERROR_CODES.AUTH_FAILED:
    case PROTOTIPO_SHARE_ERROR_CODES.UNKNOWN:
    default:
      return { kind: "fatal.unknown", httpStatus: result.httpStatus };
  }
}
