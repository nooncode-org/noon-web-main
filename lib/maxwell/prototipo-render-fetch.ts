/**
 * lib/maxwell/prototipo-render-fetch.ts
 *
 * `fetchPrototipoRender(token)` — Web → App outbound GET against the signed-read
 * endpoint per ADR-024 (Pull pattern B.2 discharge). Companion to
 * `submitPrototipoDecision` (POST side, ADR-023).
 *
 * Signing input convention: `${unix_timestamp_seconds}.` (trailing dot + empty
 * body) per ADR-024 D1 + handoff §2.3. The shared HMAC envelope helper from
 * `lib/noon-app-integration.ts` (`signNoonAppEnvelope`) computes this — the
 * empty-string body is the only difference from the POST signing path.
 *
 * Retry policy (handoff §2.10 + §2.11):
 *   - 5xx / network error: MAY retry once with ~2s backoff (the spec is more
 *     conservative than POST's 3-attempt loop; we implement 2 attempts total).
 *   - 429: MUST NOT retry within the same minute — surface to caller as-is.
 *   - 4xx (other than 429): terminal; surface to caller.
 *
 * The handler returns a discriminated union so the route file pattern-matches
 * on `result.status` and feeds the result into `mapRenderResultToUxState`.
 */

import {
  NoonAppIntegrationError,
  getNoonAppBaseUrl,
  signNoonAppEnvelope,
} from "@/lib/noon-app-integration";
import {
  PROTOTIPO_RENDER_ERROR_CODES,
  type FetchPrototipoRenderResult,
  type PrototipoRenderData,
  type PrototipoRenderErrorCode,
} from "./prototipo-render-types";

const PROTOTIPO_RENDER_PATH_PREFIX = "/api/integrations/website/prototype-signed-read";
const PROTOTIPO_RENDER_MAX_ATTEMPTS = 2;
const PROTOTIPO_RENDER_BACKOFF_MS = 2_000;
const PROTOTIPO_RENDER_JITTER_RATIO = 0.2;

type FetchOptions = {
  /**
   * Override the global fetch — used by tests. Defaults to `globalThis.fetch`
   * so the helper has no compile-time dep on a specific implementation.
   */
  fetchImpl?: typeof fetch;
};

/**
 * Classify an HTTP status + structured code into a `PrototipoRenderErrorCode`.
 * Falls back to status-based bucketing when the App body omits or returns an
 * unrecognised `code` field. UNKNOWN is the safety valve.
 */
function classifyRenderError(
  httpStatus: number,
  rawCode: string | undefined,
): PrototipoRenderErrorCode {
  if (rawCode) {
    const known = (Object.values(PROTOTIPO_RENDER_ERROR_CODES) as string[]).includes(rawCode);
    if (known) return rawCode as PrototipoRenderErrorCode;
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return PROTOTIPO_RENDER_ERROR_CODES.AUTH_FAILED;
  }
  if (httpStatus === 404) {
    return PROTOTIPO_RENDER_ERROR_CODES.TOKEN_NOT_FOUND;
  }
  if (httpStatus === 410) {
    // Without a structured code we cannot distinguish supersede vs lead-deleted —
    // bias toward the more common path (supersede). The UI copy is similar.
    return PROTOTIPO_RENDER_ERROR_CODES.TOKEN_SUPERSEDED;
  }
  if (httpStatus === 429) {
    return PROTOTIPO_RENDER_ERROR_CODES.RATE_LIMITED;
  }
  if (httpStatus >= 500) {
    return PROTOTIPO_RENDER_ERROR_CODES.INTERNAL_FAILED;
  }
  return PROTOTIPO_RENDER_ERROR_CODES.UNKNOWN;
}

/** Best-effort JSON parse — same shape as the POST-side helper. */
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
 * Validate the shape of App's 200 response just enough that the route file can
 * trust the fields it consumes. We do NOT zod-parse here — wire shape drift is
 * caught by integration tests, and over-strict validation in the helper would
 * couple the route to non-essential field churn (e.g., App adding a new
 * `lifecycle.*` field). The check is a runtime guard, not a schema audit.
 */
function isValidRenderData(value: unknown): value is PrototipoRenderData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.workspace === "object" &&
    v.workspace !== null &&
    typeof (v.workspace as Record<string, unknown>).id === "string" &&
    typeof v.leadContext === "object" &&
    v.leadContext !== null &&
    typeof v.prototype === "object" &&
    v.prototype !== null &&
    typeof v.decision === "object" &&
    v.decision !== null &&
    typeof (v.decision as Record<string, unknown>).status === "string" &&
    typeof v.lifecycle === "object" &&
    v.lifecycle !== null
  );
}

function sleepWithJitter(baseMs: number): Promise<void> {
  const jitter = baseMs * PROTOTIPO_RENDER_JITTER_RATIO;
  const delay = Math.max(0, Math.round(baseMs + (Math.random() * 2 - 1) * jitter));
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Should we attempt another retry? Per handoff §2.10 + §2.11:
 *   - 5xx: yes (transient transport)
 *   - Network error (no HTTP response): yes
 *   - 429 + other 4xx: no
 *
 * Special case: `AUTH_FAILED` is deterministic — it surfaces either from
 * misconfigured envs (missing secret/baseUrl raised as 503 by the signer) or
 * from an actual 401 wire response. Neither will resolve on retry, so we
 * short-circuit before sleeping. This keeps the misconfig path from waiting
 * `PROTOTIPO_RENDER_BACKOFF_MS` for nothing.
 */
function shouldRetryRenderOutcome(outcome: AttemptOutcome): boolean {
  if (outcome.kind === "ok") return false;
  if (
    outcome.result.status === "error" &&
    outcome.result.code === PROTOTIPO_RENDER_ERROR_CODES.AUTH_FAILED
  ) {
    return false;
  }
  if (outcome.httpStatus === null) return true;
  return outcome.httpStatus >= 500 && outcome.httpStatus < 600;
}

type AttemptOutcome =
  | { kind: "ok"; result: FetchPrototipoRenderResult }
  | {
      kind: "error";
      result: FetchPrototipoRenderResult;
      httpStatus: number | null;
    };

async function attemptFetch(
  url: string,
  fetchImpl: typeof fetch,
): Promise<AttemptOutcome> {
  let envelope;
  try {
    envelope = signNoonAppEnvelope("");
  } catch (error) {
    // Misconfigured secret/baseUrl path — surfaces as AUTH_FAILED so the route
    // renders the generic transient state and we log loudly server-side.
    if (error instanceof NoonAppIntegrationError) {
      return {
        kind: "error",
        result: {
          status: "error",
          code: PROTOTIPO_RENDER_ERROR_CODES.AUTH_FAILED,
          httpStatus: error.status,
          message: error.message,
          requestId: null,
        },
        httpStatus: error.status,
      };
    }
    throw error;
  }

  let response: Response;
  try {
    response = await fetchImpl(url, { method: "GET", headers: envelope.headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network failure";
    return {
      kind: "error",
      result: {
        status: "error",
        code: PROTOTIPO_RENDER_ERROR_CODES.INTERNAL_FAILED,
        httpStatus: 0,
        message,
        requestId: null,
      },
      httpStatus: null,
    };
  }

  const responseText = await response.text().catch(() => "");

  if (response.ok) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return {
        kind: "error",
        result: {
          status: "error",
          code: PROTOTIPO_RENDER_ERROR_CODES.INTERNAL_FAILED,
          httpStatus: response.status,
          message: "App returned a non-JSON 200 body.",
          requestId: null,
        },
        httpStatus: response.status,
      };
    }
    const data =
      parsed && typeof parsed === "object" && "data" in parsed
        ? (parsed as { data: unknown }).data
        : null;
    if (!isValidRenderData(data)) {
      return {
        kind: "error",
        result: {
          status: "error",
          code: PROTOTIPO_RENDER_ERROR_CODES.INTERNAL_FAILED,
          httpStatus: response.status,
          message: "App 200 body failed shape validation.",
          requestId:
            parsed && typeof parsed === "object" && "requestId" in parsed
              ? String((parsed as { requestId: unknown }).requestId)
              : null,
        },
        httpStatus: response.status,
      };
    }
    const requestId =
      parsed && typeof parsed === "object" && "requestId" in parsed
        ? String((parsed as { requestId: unknown }).requestId)
        : null;
    return {
      kind: "ok",
      result: {
        status: "ok",
        data,
        requestId,
        cacheControl: response.headers.get("cache-control"),
      },
    };
  }

  const parsedErr = parseErrorBody(responseText);
  return {
    kind: "error",
    result: {
      status: "error",
      code: classifyRenderError(response.status, parsedErr.code),
      httpStatus: response.status,
      message: parsedErr.error ?? responseText.slice(0, 280) ?? `HTTP ${response.status}`,
      requestId: parsedErr.requestId ?? null,
    },
    httpStatus: response.status,
  };
}

/**
 * Fetch the signed-read render data for a token.
 *
 * Never throws — all failure modes are folded into the `error` variant of the
 * discriminated union, including misconfigured environments. The route file
 * can therefore call this in a Server Component without try/catch and rely on
 * the UX mapper to render the right state.
 */
export async function fetchPrototipoRender(
  token: string,
  options: FetchOptions = {},
): Promise<FetchPrototipoRenderResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return {
      status: "error",
      code: PROTOTIPO_RENDER_ERROR_CODES.INTERNAL_FAILED,
      httpStatus: 0,
      message: "No fetch implementation available.",
      requestId: null,
    };
  }

  let baseUrl: string;
  try {
    baseUrl = getNoonAppBaseUrl();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Base URL unavailable";
    return {
      status: "error",
      code: PROTOTIPO_RENDER_ERROR_CODES.AUTH_FAILED,
      httpStatus: error instanceof NoonAppIntegrationError ? error.status : 503,
      message,
      requestId: null,
    };
  }

  const url = `${baseUrl}${PROTOTIPO_RENDER_PATH_PREFIX}/${encodeURIComponent(token)}`;

  let lastOutcome: AttemptOutcome | null = null;
  for (let attempt = 1; attempt <= PROTOTIPO_RENDER_MAX_ATTEMPTS; attempt++) {
    const outcome = await attemptFetch(url, fetchImpl);
    lastOutcome = outcome;
    if (outcome.kind === "ok") return outcome.result;
    if (attempt === PROTOTIPO_RENDER_MAX_ATTEMPTS) break;
    if (!shouldRetryRenderOutcome(outcome)) break;
    await sleepWithJitter(PROTOTIPO_RENDER_BACKOFF_MS);
  }
  // The loop above always assigns lastOutcome on attempt 1; defensive fallback.
  return (
    lastOutcome?.result ?? {
      status: "error",
      code: PROTOTIPO_RENDER_ERROR_CODES.INTERNAL_FAILED,
      httpStatus: 0,
      message: "Render fetch produced no outcome.",
      requestId: null,
    }
  );
}
