/**
 * lib/maxwell/prototipo-share.ts
 *
 * `requestPrototipoShare` — Web → App outbound webhook for the D-upstream
 * wire (ADR-028). Mirrors `submitPrototipoDecision` from the D-slice:
 *
 *   1. Build payload per ADR-028 §D2.
 *   2. Sign with the shared HMAC secret via `postNoonAppWebhook`.
 *   3. POST to App's `/api/integrations/website/prototype-share`.
 *   4. Map App's structured response (`{ data, requestId }` or
 *      `{ error, code, requestId }`) into a `RequestPrototipoShareResult`
 *      discriminated union.
 *
 * Retry policy is inherited from `postNoonAppWebhook`: 3 attempts total,
 * 1s + 2s backoff with ±20% jitter, retry on 5xx + network errors, do not
 * retry on 4xx. The helper does NOT add a fourth retry layer (per ADR-028
 * D16 allowed shortcuts).
 *
 * Idempotency is App's responsibility per ADR-028 D4: transport-level via
 * `website_webhook_events` ledger AND application-level via the
 * `(external_session_id, v0_chat_id)` resource dedup. No payload-level
 * key — explicitly forbidden by D16.
 */

import { NoonAppIntegrationError, postNoonAppWebhook } from "@/lib/noon-app-integration";
import {
  PROTOTIPO_SHARE_ERROR_CODES,
  type PrototipoShareErrorCode,
  type PrototipoSharePayload,
  type PrototipoShareResponseData,
  type RequestPrototipoShareResult,
} from "./prototipo-share-types";

const PROTOTIPO_SHARE_PATH = "/api/integrations/website/prototype-share";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Status + structured code → `PrototipoShareErrorCode`. When the body carries
 * a recognised code, use it. Otherwise bucket by HTTP status so the UI always
 * has a deterministic bucket to render. `UNKNOWN` is the catch-all.
 */
function classifyError(
  httpStatus: number,
  rawCode: string | undefined,
): PrototipoShareErrorCode {
  if (rawCode) {
    const known = (Object.values(PROTOTIPO_SHARE_ERROR_CODES) as string[]).includes(rawCode);
    if (known) return rawCode as PrototipoShareErrorCode;
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return PROTOTIPO_SHARE_ERROR_CODES.AUTH_FAILED;
  }
  if (httpStatus === 429) {
    return PROTOTIPO_SHARE_ERROR_CODES.RATE_LIMITED;
  }
  if (httpStatus >= 500) {
    return PROTOTIPO_SHARE_ERROR_CODES.PERSIST_FAILED;
  }
  return PROTOTIPO_SHARE_ERROR_CODES.UNKNOWN;
}

/**
 * Best-effort parse of App's structured error envelope per
 * `cross-repo-webhook-v1.md` §8. Malformed body falls through to the
 * status-based classifier.
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
 * Validate App's success envelope. Expected shape per ADR-028 D3:
 * `{ data: { ... }, requestId: string }`. Returns the typed data + requestId
 * on success, or null when the body is missing required fields (caller treats
 * that as an UNKNOWN error to avoid handing partial data to the UI).
 */
function parseSuccessBody(value: unknown): {
  data: PrototipoShareResponseData;
  requestId: string | null;
} | null {
  if (!value || typeof value !== "object") return null;
  const envelope = value as Record<string, unknown>;
  const data = envelope.data;
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  if (
    typeof d.share_token !== "string" ||
    typeof d.prototype_workspace_id !== "string" ||
    typeof d.lead_id !== "string" ||
    typeof d.version_number !== "number" ||
    typeof d.issued_at !== "string"
  ) {
    return null;
  }

  const supersededRaw = d.superseded_workspace_ids;
  const superseded = Array.isArray(supersededRaw)
    ? supersededRaw.filter((v): v is string => typeof v === "string")
    : [];

  return {
    data: {
      idempotent: d.idempotent === true,
      share_token: d.share_token,
      prototype_workspace_id: d.prototype_workspace_id,
      lead_id: d.lead_id,
      version_number: d.version_number,
      issued_at: d.issued_at,
      superseded_workspace_ids: superseded,
    },
    requestId: typeof envelope.requestId === "string" ? envelope.requestId : null,
  };
}

// ============================================================================
// Input type
// ============================================================================

export type RequestPrototipoShareInput = {
  externalSessionId: string;
  lead: {
    businessName: string;
    projectTypeLabel: string;
    customer?: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      whatsapp?: string | null;
      company?: string | null;
    };
  };
  prototype: {
    v0ChatId: string;
    versionNumber: number;
    deployedUrl: string;
    generatedHtml?: string | null;
    generatedAt: string;
  };
  metadata?: Record<string, unknown>;
};

// ============================================================================
// Helper
// ============================================================================

function buildPayload(input: RequestPrototipoShareInput): PrototipoSharePayload {
  const customer = input.lead.customer
    ? {
        ...(input.lead.customer.name !== undefined ? { name: input.lead.customer.name } : {}),
        ...(input.lead.customer.email !== undefined
          ? { email: input.lead.customer.email }
          : {}),
        ...(input.lead.customer.phone !== undefined
          ? { phone: input.lead.customer.phone }
          : {}),
        ...(input.lead.customer.whatsapp !== undefined
          ? { whatsapp: input.lead.customer.whatsapp }
          : {}),
        ...(input.lead.customer.company !== undefined
          ? { company: input.lead.customer.company }
          : {}),
      }
    : undefined;

  return {
    external_source: "noon_website",
    external_session_id: input.externalSessionId,
    lead: {
      business_name: input.lead.businessName,
      project_type_label: input.lead.projectTypeLabel,
      ...(customer ? { customer } : {}),
    },
    prototype: {
      v0_chat_id: input.prototype.v0ChatId,
      version_number: input.prototype.versionNumber,
      deployed_url: input.prototype.deployedUrl,
      ...(input.prototype.generatedHtml !== undefined
        ? { generated_html: input.prototype.generatedHtml }
        : {}),
      generated_at: input.prototype.generatedAt,
    },
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export async function requestPrototipoShare(
  input: RequestPrototipoShareInput,
): Promise<RequestPrototipoShareResult> {
  const payload = buildPayload(input);

  try {
    const responseValue = await postNoonAppWebhook(PROTOTIPO_SHARE_PATH, payload);
    const parsed = parseSuccessBody(responseValue);
    if (!parsed) {
      // Wire-level success but body is malformed. UI should render a
      // fatal-unknown rather than pretend the share worked.
      return {
        status: "error",
        code: PROTOTIPO_SHARE_ERROR_CODES.UNKNOWN,
        httpStatus: 200,
        message: "App returned an unexpected response shape.",
      };
    }
    return {
      status: "ok",
      data: parsed.data,
      requestId: parsed.requestId,
      isReplay: parsed.data.idempotent,
    };
  } catch (error) {
    if (error instanceof NoonAppIntegrationError) {
      const parsedErr = parseErrorBody(error.message);
      return {
        status: "error",
        code: classifyError(error.status, parsedErr.code),
        httpStatus: error.status,
        message: parsedErr.error ?? error.message,
        ...(parsedErr.requestId ? { requestId: parsedErr.requestId } : {}),
      };
    }
    // Network / unexpected — surface as PERSIST_FAILED so the UI shows the
    // retry copy. No fourth retry layer on top of `postNoonAppWebhook`'s 3.
    const message = error instanceof Error ? error.message : "Unknown network failure";
    return {
      status: "error",
      code: PROTOTIPO_SHARE_ERROR_CODES.PERSIST_FAILED,
      httpStatus: 0,
      message,
    };
  }
}
