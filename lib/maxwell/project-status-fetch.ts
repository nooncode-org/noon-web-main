/**
 * lib/maxwell/project-status-fetch.ts
 *
 * `fetchNoonAppProjectStatus(projectId)` — Web → App outbound GET against the
 * v3 client-portal project-status signed-read (Slice 1a;
 * `docs/v3-client-portal-plan.md` §3.1/§4). Companion in spirit to
 * `fetchPrototipoRender` (the D-slice render read): same empty-body HMAC
 * signing convention (`${unix_timestamp}.`), same never-throws discriminated
 * union, same conservative retry policy.
 *
 * Auth model: the HMAC signature IS the auth; `projectId` (NoonWeb's stored
 * `noon_app_project_id`, == `projects.id`) selects the resource. No capability
 * token. App route: `GET /api/integrations/website/project-status/{projectId}`.
 *
 * Retry policy (mirrors the prototipo read, intentionally conservative for a
 * render-time read): 2 attempts total; retry on 5xx / network error; do NOT
 * retry on 4xx / 429 / AUTH (deterministic).
 */

import {
  NoonAppIntegrationError,
  getNoonAppBaseUrl,
  signNoonAppEnvelope,
} from "@/lib/noon-app-integration";
import { assertNoInternalFields } from "@/lib/security/project-isolation";
import {
  PROJECT_STATUS_ERROR_CODES,
  projectStatusEnvelopeSchema,
  type FetchProjectStatusResult,
  type ProjectStatusErrorCode,
} from "./project-status-types";

const PROJECT_STATUS_PATH_PREFIX = "/api/integrations/website/project-status";
const PROJECT_STATUS_MAX_ATTEMPTS = 2;
const PROJECT_STATUS_BACKOFF_MS = 2_000;
const PROJECT_STATUS_JITTER_RATIO = 0.2;

type FetchOptions = {
  /** Override the global fetch — used by tests. Defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
};

/**
 * Classify an HTTP status + structured code into a `ProjectStatusErrorCode`.
 * Falls back to status-based bucketing when the App body omits or returns an
 * unrecognised `code` field.
 */
function classifyStatusError(
  httpStatus: number,
  rawCode: string | undefined,
): ProjectStatusErrorCode {
  if (rawCode) {
    const known = (Object.values(PROJECT_STATUS_ERROR_CODES) as string[]).includes(rawCode);
    if (known) return rawCode as ProjectStatusErrorCode;
  }
  if (httpStatus === 401 || httpStatus === 403) return PROJECT_STATUS_ERROR_CODES.AUTH_FAILED;
  if (httpStatus === 404) return PROJECT_STATUS_ERROR_CODES.NOT_FOUND;
  if (httpStatus === 429) return PROJECT_STATUS_ERROR_CODES.RATE_LIMITED;
  if (httpStatus === 400) return PROJECT_STATUS_ERROR_CODES.INVALID_REQUEST;
  if (httpStatus >= 500) return PROJECT_STATUS_ERROR_CODES.INTERNAL_FAILED;
  return PROJECT_STATUS_ERROR_CODES.UNKNOWN;
}

/** Best-effort JSON parse of an error body — same shape as the prototipo helper. */
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

function sleepWithJitter(baseMs: number): Promise<void> {
  const jitter = baseMs * PROJECT_STATUS_JITTER_RATIO;
  const delay = Math.max(0, Math.round(baseMs + (Math.random() * 2 - 1) * jitter));
  return new Promise((resolve) => setTimeout(resolve, delay));
}

type AttemptOutcome =
  | { kind: "ok"; result: FetchProjectStatusResult }
  | { kind: "error"; result: FetchProjectStatusResult; httpStatus: number | null };

/**
 * Retry only transient transport failures. AUTH is deterministic (misconfigured
 * env or a real 401) and will not resolve on retry, so short-circuit it before
 * sleeping.
 */
function shouldRetryOutcome(outcome: AttemptOutcome): boolean {
  if (outcome.kind === "ok") return false;
  if (
    outcome.result.status === "error" &&
    outcome.result.code === PROJECT_STATUS_ERROR_CODES.AUTH_FAILED
  ) {
    return false;
  }
  if (outcome.httpStatus === null) return true;
  return outcome.httpStatus >= 500 && outcome.httpStatus < 600;
}

async function attemptFetch(url: string, fetchImpl: typeof fetch): Promise<AttemptOutcome> {
  let envelope;
  try {
    envelope = signNoonAppEnvelope("");
  } catch (error) {
    // Misconfigured secret/baseUrl — surfaces as AUTH_FAILED so the workspace
    // falls back to the local status and we log loudly server-side.
    if (error instanceof NoonAppIntegrationError) {
      return {
        kind: "error",
        result: {
          status: "error",
          code: PROJECT_STATUS_ERROR_CODES.AUTH_FAILED,
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
        code: PROJECT_STATUS_ERROR_CODES.INTERNAL_FAILED,
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
          code: PROJECT_STATUS_ERROR_CODES.INTERNAL_FAILED,
          httpStatus: response.status,
          message: "App returned a non-JSON 200 body.",
          requestId: null,
        },
        httpStatus: response.status,
      };
    }

    // Defensive §8.3 tripwire on the RAW body (before the allowlist strip) —
    // catches a camelCase internal field if the App ever spread one in. The
    // primary guarantee is the Zod allowlist parse below, which drops ALL
    // unmodeled keys (incl. snake_case App columns like `budget`); this assert
    // is belt-and-suspenders per the plan §3.2.
    try {
      assertNoInternalFields(parsed, "project-status signed-read");
    } catch (error) {
      return {
        kind: "error",
        result: {
          status: "error",
          code: PROJECT_STATUS_ERROR_CODES.INTERNAL_FAILED,
          httpStatus: response.status,
          message: error instanceof Error ? error.message : "Internal field leaked.",
          requestId: extractRequestId(parsed),
        },
        httpStatus: response.status,
      };
    }

    const validated = projectStatusEnvelopeSchema.safeParse(parsed);
    if (!validated.success) {
      return {
        kind: "error",
        result: {
          status: "error",
          code: PROJECT_STATUS_ERROR_CODES.INTERNAL_FAILED,
          httpStatus: response.status,
          message: `App 200 body failed schema validation: ${validated.error.issues[0]?.message ?? "unknown"}`,
          requestId: extractRequestId(parsed),
        },
        httpStatus: response.status,
      };
    }

    return {
      kind: "ok",
      result: {
        status: "ok",
        data: validated.data.data,
        requestId: validated.data.requestId ?? null,
        cacheControl: response.headers.get("cache-control"),
      },
    };
  }

  const parsedErr = parseErrorBody(responseText);
  return {
    kind: "error",
    result: {
      status: "error",
      code: classifyStatusError(response.status, parsedErr.code),
      httpStatus: response.status,
      message: parsedErr.error ?? responseText.slice(0, 280) ?? `HTTP ${response.status}`,
      requestId: parsedErr.requestId ?? null,
    },
    httpStatus: response.status,
  };
}

function extractRequestId(parsed: unknown): string | null {
  if (parsed && typeof parsed === "object" && "requestId" in parsed) {
    const value = (parsed as { requestId: unknown }).requestId;
    return typeof value === "string" ? value : null;
  }
  return null;
}

/**
 * Fetch the sanitized project-status snapshot for a project id.
 *
 * Never throws — all failure modes (misconfig, network, 4xx/5xx, schema drift,
 * leaked-field tripwire) fold into the `error` variant. The workspace page
 * renders the App status when `status === "ok"` and falls back to the local
 * `workspace_status` otherwise.
 */
export async function fetchNoonAppProjectStatus(
  projectId: string,
  options: FetchOptions = {},
): Promise<FetchProjectStatusResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return {
      status: "error",
      code: PROJECT_STATUS_ERROR_CODES.INTERNAL_FAILED,
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
      code: PROJECT_STATUS_ERROR_CODES.AUTH_FAILED,
      httpStatus: error instanceof NoonAppIntegrationError ? error.status : 503,
      message,
      requestId: null,
    };
  }

  const url = `${baseUrl}${PROJECT_STATUS_PATH_PREFIX}/${encodeURIComponent(projectId)}`;

  let lastOutcome: AttemptOutcome | null = null;
  for (let attempt = 1; attempt <= PROJECT_STATUS_MAX_ATTEMPTS; attempt++) {
    const outcome = await attemptFetch(url, fetchImpl);
    lastOutcome = outcome;
    if (outcome.kind === "ok") return outcome.result;
    if (attempt === PROJECT_STATUS_MAX_ATTEMPTS) break;
    if (!shouldRetryOutcome(outcome)) break;
    await sleepWithJitter(PROJECT_STATUS_BACKOFF_MS);
  }

  return (
    lastOutcome?.result ?? {
      status: "error",
      code: PROJECT_STATUS_ERROR_CODES.INTERNAL_FAILED,
      httpStatus: 0,
      message: "Project-status fetch produced no outcome.",
      requestId: null,
    }
  );
}
