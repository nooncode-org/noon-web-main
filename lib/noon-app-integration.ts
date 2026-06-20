import crypto from "node:crypto";
import { z, ZodError, type ZodTypeAny } from "zod";
import type { StudioSession, ProposalRequest, StudioVersion } from "@/lib/maxwell/repositories";
import type { ClientRequestType, ClientRequestPriority } from "@/lib/maxwell/client-requests";
import { clientVisibleStateSchema } from "@/lib/maxwell/client-requests";
import { resolveProposalCommercialProfile } from "@/lib/maxwell/proposal-rules";

const SIGNATURE_HEADER = "x-noon-signature";
const TIMESTAMP_HEADER = "x-noon-timestamp";
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

export class NoonAppIntegrationError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = "NoonAppIntegrationError";
  }
}

/**
 * Reads the shared HMAC secret used for cross-repo webhooks.
 *
 * Per the cross-repo contract v1 (`App-nooncode/docs/integrations/cross-repo-webhook-v1.md`)
 * the canonical name on BOTH sides is `NOON_WEBSITE_WEBHOOK_SECRET`. The legacy
 * `NOON_APP_WEBHOOK_SECRET` fallback was removed on 2026-05-25 after both repos
 * completed the rename and ops deleted the legacy env from Vercel.
 *
 * Safety-net preserved as a commented block below in case a future cross-repo rename
 * needs the same fallback pattern.
 */
function readSharedWebhookSecret(): string | null {
  return process.env.NOON_WEBSITE_WEBHOOK_SECRET?.trim() || null;
  // Legacy fallback (removed 2026-05-25):
  //   return (
  //     process.env.NOON_WEBSITE_WEBHOOK_SECRET?.trim() ||
  //     process.env.NOON_APP_WEBHOOK_SECRET?.trim() ||
  //     null
  //   );
}

/** True when outbound signed webhooks to Noon App can be sent (proposal handoff, payment, etc.). */
export function isNoonAppProposalHandoffConfigured(): boolean {
  return Boolean(readSharedWebhookSecret() && process.env.NOON_APP_BASE_URL?.trim());
}

function readNoonAppSecret() {
  const secret = readSharedWebhookSecret();
  if (!secret) {
    throw new NoonAppIntegrationError(
      "NOON_WEBSITE_WEBHOOK_SECRET is not configured.",
      503,
    );
  }
  return secret;
}

function readNoonAppBaseUrl() {
  const baseUrl = process.env.NOON_APP_BASE_URL?.trim();
  if (!baseUrl) {
    throw new NoonAppIntegrationError("NOON_APP_BASE_URL is not configured.", 503);
  }
  return baseUrl.replace(/\/$/, "");
}

function normalizeSignature(signature: string) {
  return signature.trim().replace(/^sha256=/i, "");
}

function timingSafeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * F-1 mirror fix (2026-05-18): rejects requests where `x-noon-timestamp` is
 * absent. Mirror of App-nooncode commit 92f1e0b. The `: asserts timestamp is
 * string` signature lets the caller treat `timestamp` as a non-null string
 * in scope after this call returns, which is what allows the unconditional
 * `${timestamp}.${bodyText}` payload in verifyNoonAppSignature below.
 *
 * Status 401 is passed explicitly to NoonAppIntegrationError (its default
 * 502 applies to infra failures, not auth).
 */
function assertRecentTimestamp(timestamp: string | null): asserts timestamp is string {
  if (!timestamp) {
    throw new NoonAppIntegrationError("Missing Noon App timestamp.", 401);
  }

  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed)) {
    throw new NoonAppIntegrationError("Invalid Noon App timestamp.", 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed) > MAX_CLOCK_SKEW_SECONDS) {
    throw new NoonAppIntegrationError("Noon App timestamp is outside the allowed window.", 401);
  }
}

function verifyNoonAppSignature(headers: Headers, bodyText: string) {
  const signature = headers.get(SIGNATURE_HEADER);
  const timestamp = headers.get(TIMESTAMP_HEADER);

  if (!signature) {
    throw new NoonAppIntegrationError("Missing Noon App signature.", 401);
  }

  assertRecentTimestamp(timestamp);

  // Unconditional — the assert above guarantees timestamp is a string.
  // Pre-F-1 this line was `timestamp ? \`${timestamp}.${bodyText}\` : bodyText`,
  // which let attackers omit the timestamp header and replay arbitrary bodies
  // (the body-only signature collision required the secret, but the bypass of
  // the anti-replay ±5min window made the path unsafe by design).
  const signedPayload = `${timestamp}.${bodyText}`;
  const expected = crypto.createHmac("sha256", readNoonAppSecret()).update(signedPayload).digest("hex");

  if (!timingSafeEquals(normalizeSignature(signature), expected)) {
    throw new NoonAppIntegrationError("Invalid Noon App signature.", 401);
  }
}

export async function readSignedNoonAppJson<TSchema extends ZodTypeAny>(
  request: Request,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const bodyText = await request.text();
  verifyNoonAppSignature(request.headers, bodyText);

  try {
    return schema.parse(JSON.parse(bodyText));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new NoonAppIntegrationError("Invalid JSON payload.", 400);
    }
    if (error instanceof ZodError) {
      throw new NoonAppIntegrationError(error.issues[0]?.message ?? "Invalid payload.", 400);
    }
    throw error;
  }
}

/**
 * Verify the HMAC envelope and return the RAW parsed JSON (no schema applied),
 * so a receiver can run an `assertNoInternalFields` tripwire on the raw body
 * BEFORE its own allowlist parse — the §8.3 defensive pattern the project-status
 * read uses. Reuses the exact signature scheme as `readSignedNoonAppJson`
 * (`${ts}.${rawBody}`, ±5min skew, missing-timestamp rejected per F-1).
 */
export async function readSignedNoonAppRawJson(request: Request): Promise<unknown> {
  const bodyText = await request.text();
  verifyNoonAppSignature(request.headers, bodyText);

  try {
    return JSON.parse(bodyText);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new NoonAppIntegrationError("Invalid JSON payload.", 400);
    }
    throw error;
  }
}

/**
 * Compute the HMAC envelope (timestamp + signature) for an arbitrary body text.
 *
 * Shared by:
 *   - POST handoff via `signPayload` (body = serialized JSON).
 *   - GET `prototype-signed-read` via `lib/maxwell/prototipo-render-fetch.ts`
 *     (body = empty string, signing input becomes `${timestamp}.` per ADR-024 D1).
 *
 * Returns the unprefixed timestamp + the `sha256=<hex>` header value so callers
 * can compose headers per their request method (POST adds content-type, GET does not).
 */
export function signNoonAppEnvelope(bodyText: string): {
  timestamp: string;
  signature: string;
  headers: Record<string, string>;
} {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signatureHex = crypto
    .createHmac("sha256", readNoonAppSecret())
    .update(`${timestamp}.${bodyText}`)
    .digest("hex");
  const signatureHeader = `sha256=${signatureHex}`;

  return {
    timestamp,
    signature: signatureHeader,
    headers: {
      [TIMESTAMP_HEADER]: timestamp,
      [SIGNATURE_HEADER]: signatureHeader,
    },
  };
}

/** Public accessor for the Noon App base URL — throws via NoonAppIntegrationError if unset. */
export function getNoonAppBaseUrl(): string {
  return readNoonAppBaseUrl();
}

function signPayload(bodyText: string) {
  const { headers } = signNoonAppEnvelope(bodyText);
  return {
    "content-type": "application/json",
    ...headers,
  };
}

/**
 * Retry policy for Noon App outbound webhooks (B9).
 *
 * - Max 3 attempts total (initial + 2 retries).
 * - Exponential backoff with ±20% jitter: 1s, 2s (after first failure / second failure).
 * - Retry on: 5xx responses, network errors (fetch throws without an HTTP response).
 * - Do NOT retry on: 4xx responses (auth / validation are deterministic failures).
 * - Idempotency: handled by App side via `external_*_id` keys, so the same payload sent
 *   twice produces one row on App. Web does not need a nonce ledger.
 *
 * Dead-letter behaviour is intentionally out of scope here — the caller already records
 * `noon_app_*_failed` audit events. Persistent queue + alerting is a future iteration.
 */
const NOON_APP_RETRY_ATTEMPTS = 3;
const NOON_APP_RETRY_BACKOFF_MS = [1_000, 2_000] as const; // delays before attempts 2 and 3
const NOON_APP_RETRY_JITTER_RATIO = 0.2;

function shouldRetryNoonAppFailure(error: unknown): boolean {
  if (error instanceof NoonAppIntegrationError) {
    // 5xx is server-side transient. 4xx is deterministic — do not retry.
    return error.status >= 500 && error.status < 600;
  }
  // Network / DNS / abort / etc. fetch() throws TypeError or DOMException without a
  // response. Treat as transient.
  return true;
}

function nextNoonAppBackoffMs(attempt: number): number {
  const base = NOON_APP_RETRY_BACKOFF_MS[attempt - 1];
  if (!base) return 0;
  const jitter = base * NOON_APP_RETRY_JITTER_RATIO;
  // Math.random() in [0,1). Map to [-jitter, +jitter].
  return Math.round(base + (Math.random() * 2 - 1) * jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postNoonAppWebhookOnce(path: string, bodyText: string) {
  const response = await fetch(`${readNoonAppBaseUrl()}${path}`, {
    method: "POST",
    headers: signPayload(bodyText),
    body: bodyText,
  });

  const responseText = await response.text().catch(() => "");

  if (!response.ok) {
    throw new NoonAppIntegrationError(
      responseText || `Noon App returned HTTP ${response.status}.`,
      response.status,
    );
  }

  return { response, responseText };
}

export async function postNoonAppWebhook(path: string, payload: unknown) {
  const bodyText = JSON.stringify(payload);

  let lastError: unknown;
  for (let attempt = 1; attempt <= NOON_APP_RETRY_ATTEMPTS; attempt++) {
    try {
      const { responseText } = await postNoonAppWebhookOnce(path, bodyText);

      if (!responseText) return null;

      try {
        return JSON.parse(responseText) as unknown;
      } catch {
        return responseText;
      }
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === NOON_APP_RETRY_ATTEMPTS;
      if (isLastAttempt || !shouldRetryNoonAppFailure(error)) {
        throw error;
      }
      // Wait before the next attempt (backoff index = attempt - 1 → first wait is 1s).
      const delayMs = nextNoonAppBackoffMs(attempt);
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  // Defensive: the loop above always either returns or throws, but keep TS happy.
  throw lastError ?? new NoonAppIntegrationError("Noon App webhook failed without a captured error.", 502);
}


function requireCustomerEmail(session: StudioSession, proposal: ProposalRequest) {
  const email = session.ownerEmail ?? proposal.deliveryRecipient;
  if (!email) {
    throw new NoonAppIntegrationError("Inbound handoff requires a customer email.", 422);
  }
  return email;
}

function proposalTitle(session: StudioSession) {
  return session.goalSummary ?? session.initialPrompt.slice(0, 90);
}

function parseUsdAmount(value: string) {
  const normalized = value.replace(/,/g, "");
  const match = normalized.match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  return Number(match[1]);
}

function estimateProposalAmount(session: StudioSession) {
  const profile = resolveProposalCommercialProfile(session);
  return {
    amount: parseUsdAmount(profile.pricing.activation),
    currency: "USD",
    pricing: profile.pricing,
    category: profile.category,
    tier: profile.tier,
    membershipRecommended: profile.membershipRecommended,
  };
}

function resolveApprovedProposalAmount(session: StudioSession, proposal: ProposalRequest) {
  if (proposal.approvedAmountUsd != null && proposal.approvedCurrency) {
    return {
      amount: proposal.approvedAmountUsd,
      currency: proposal.approvedCurrency.toUpperCase(),
      source: "noon_app_pm_approved",
      estimate: estimateProposalAmount(session),
    };
  }

  const estimate = estimateProposalAmount(session);
  return {
    amount: estimate.amount,
    currency: estimate.currency,
    source: "website_pricing_profile",
    estimate,
  };
}

function buildMaxwellSnapshot(session: StudioSession, versions: StudioVersion[]) {
  const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;
  return {
    summary: session.goalSummary ?? session.initialPrompt,
    prototype_url: latestVersion?.previewUrl ?? null,
    prototype_versions: versions.map((version) => ({
      label: `Version ${version.versionNumber}`,
      url: version.previewUrl,
      version_number: version.versionNumber,
      v0_chat_id: version.v0ChatId,
    })),
  };
}

export function buildWebsiteProposalPayload(input: {
  session: StudioSession;
  proposal: ProposalRequest;
  versions: StudioVersion[];
}) {
  const { session, proposal, versions } = input;
  const amount = resolveApprovedProposalAmount(session, proposal);
  const estimate = amount.estimate;

  return {
    external_source: "noon_website",
    external_session_id: session.id,
    external_proposal_id: proposal.id,
    customer: {
      name: session.ownerName ?? requireCustomerEmail(session, proposal),
      email: requireCustomerEmail(session, proposal),
      company: null,
    },
    proposal: {
      title: proposalTitle(session),
      body: proposal.draftContent ?? "",
      amount: amount.amount,
      currency: amount.currency,
    },
    maxwell: buildMaxwellSnapshot(session, versions),
    metadata: {
      public_token: proposal.publicToken,
      version_number: proposal.versionNumber,
      case_classification: proposal.caseClassification,
      estimated_amount_source: amount.source,
      pricing: estimate.pricing,
      pricing_category: estimate.category,
      pricing_tier: estimate.tier,
      membership_recommended: estimate.membershipRecommended,
    },
  };
}

export async function sendInboundProposalToNoonApp(input: {
  session: StudioSession;
  proposal: ProposalRequest;
  versions: StudioVersion[];
}) {
  return postNoonAppWebhook(
    "/api/integrations/website/inbound-proposal",
    buildWebsiteProposalPayload(input),
  );
}

/**
 * Pull App's project id out of the payment-confirmed response (PR-B).
 *
 * App's `/api/integrations/website/payment-confirmed` returns
 * `{ idempotent, linkId, leadId, proposalId, projectId, status }`
 * (App/lib/server/website-integration.ts). We only need `projectId`, and only
 * to map inbound AI MVP milestones back to a local workspace. Best-effort by
 * design: returns null for any shape we don't recognise so a contract drift on
 * App's side degrades the milestone UI gracefully instead of failing the
 * payment flow.
 */
export function extractNoonAppProjectId(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const projectId = (response as { projectId?: unknown }).projectId;
  return typeof projectId === "string" && projectId.trim() ? projectId : null;
}

export async function sendPaymentConfirmedToNoonApp(input: {
  session: StudioSession;
  proposal: ProposalRequest;
  versions: StudioVersion[];
  paymentReference?: string | null;
  summary?: string | null;
}) {
  const basePayload = buildWebsiteProposalPayload(input);
  const externalPaymentId = input.paymentReference?.trim() || `website:${input.proposal.id}:confirmed`;

  return postNoonAppWebhook("/api/integrations/website/payment-confirmed", {
    external_source: basePayload.external_source,
    external_session_id: basePayload.external_session_id,
    external_proposal_id: basePayload.external_proposal_id,
    external_payment_id: externalPaymentId,
    customer: basePayload.customer,
    proposal: basePayload.proposal,
    maxwell: basePayload.maxwell,
    handoff: {
      summary: input.summary ?? input.session.goalSummary ?? input.session.initialPrompt,
      final_proposal_public_token: input.proposal.publicToken,
      final_prototype_url: basePayload.maxwell.prototype_url,
    },
    payment: {
      amount: basePayload.proposal.amount,
      currency: basePayload.proposal.currency,
      provider: input.paymentReference?.startsWith("pi_") || input.paymentReference?.startsWith("cs_")
        ? "stripe"
        : "website",
      paid_at: new Date().toISOString(),
    },
    metadata: {
      ...basePayload.metadata,
      payment_reference: input.paymentReference ?? null,
    },
  });
}

/**
 * Client-comment write-back (v3 client portal, Slice 1b). Forwards a client's
 * workspace comment to App's interim receiver
 * (`POST /api/integrations/website/client-comment`).
 *
 * camelCase wire — the v3 family, NOT the legacy snake_case POST webhooks (see
 * the co-signed casing rule in docs/v3-client-portal-plan.md §3.1). App de-dupes
 * on `externalCommentId` and replies `{ idempotent, commentId, requestId }` with
 * HTTP 200 on both first-write and replay.
 *
 * Contract: App-nooncode specs/v3-client-portal-comment-receiver.md §A.
 */
export function buildClientCommentPayload(input: {
  projectId: string;
  externalCommentId: string;
  body: string;
  at?: string;
}) {
  return {
    projectId: input.projectId,
    externalCommentId: input.externalCommentId,
    author: "client" as const,
    body: input.body,
    at: input.at ?? new Date().toISOString(),
  };
}

/**
 * Best-effort extraction of App's `{ idempotent, commentId }` from the receiver
 * reply. Returns nulls/false for any shape we don't recognise so a contract
 * drift degrades the audit trail gracefully instead of throwing in the action.
 */
export function extractNoonAppCommentId(response: unknown): {
  commentId: string | null;
  idempotent: boolean;
} {
  if (!response || typeof response !== "object") {
    return { commentId: null, idempotent: false };
  }
  const obj = response as { commentId?: unknown; idempotent?: unknown };
  return {
    commentId:
      typeof obj.commentId === "string" && obj.commentId.trim() ? obj.commentId : null,
    idempotent: obj.idempotent === true,
  };
}

export async function sendClientCommentToNoonApp(input: {
  projectId: string;
  externalCommentId: string;
  body: string;
  at?: string;
}) {
  return postNoonAppWebhook(
    "/api/integrations/website/client-comment",
    buildClientCommentPayload(input),
  );
}

/**
 * Client-request submission (v3 client-request system §9, Slice A). Forwards a
 * payment-activated client's typed request to App's receiver
 * (`POST /api/integrations/website/client-request`). camelCase wire (v3 family).
 * App de-dupes on `externalRequestId`.
 *
 * Contract: docs/v3-client-requests-noonweb-design.md §1 + the co-design handoffs.
 */

/**
 * Derive the opaque `submittedBy` id for a client request.
 *
 * NoonWeb's JWT auth carries only the client's email (no stable user id). The
 * frozen contract requires an OPAQUE id, NOT the email (data minimization — the
 * App must not duplicate the client's email in its request store). We derive a
 * stable, non-reversible id as `HMAC-SHA256(normalized email, shared secret)`:
 * the pepper (the shared webhook secret) defeats the dictionary attack a bare
 * `sha256(email)` would allow on low-entropy emails. Same email -> same id, so a
 * shared account still distinguishes which human submitted.
 *
 * Throws (503) when the secret is unset — callers gate on
 * `isNoonAppProposalHandoffConfigured()` first, so this only runs when configured.
 */
export function deriveSubmitterId(email: string): string {
  const normalized = email.trim().toLowerCase();
  return crypto.createHmac("sha256", readNoonAppSecret()).update(normalized).digest("hex");
}

/**
 * Build the §9 client-request wire payload. `versionRef` (B.4, co-signed
 * 2026-06-20) is OMITTED entirely when null/undefined so a request without a
 * version link stays byte-identical to the pre-B.4 wire (additive, back-compat).
 * Present, it == the App's `versionSequenceNumber`; the App resolves it lazily
 * staff-side and is dangling-tolerant (Q-B4-3).
 */
export function buildClientRequestPayload(input: {
  projectId: string;
  externalRequestId: string;
  submittedBy: string;
  type: ClientRequestType;
  clientPriority: ClientRequestPriority;
  body: string;
  versionRef?: number | null;
  at?: string;
}) {
  return {
    externalRequestId: input.externalRequestId,
    projectId: input.projectId,
    submittedBy: input.submittedBy,
    type: input.type,
    clientPriority: input.clientPriority,
    body: input.body,
    ...(input.versionRef != null ? { versionRef: input.versionRef } : {}),
    at: input.at ?? new Date().toISOString(),
  };
}

/**
 * Best-effort extraction of App's create-reply for audit logging. Returns
 * nulls/false for any shape we don't recognise so a contract drift degrades the
 * log gracefully instead of throwing. NoonWeb keys the outbound state receiver
 * on `externalRequestId` (not App's internal id), so App's request id is
 * logged, never persisted.
 */
export function extractNoonAppRequestAck(response: unknown): {
  requestId: string | null;
  idempotent: boolean;
} {
  if (!response || typeof response !== "object") {
    return { requestId: null, idempotent: false };
  }
  const obj = response as { requestId?: unknown; idempotent?: unknown };
  return {
    requestId:
      typeof obj.requestId === "string" && obj.requestId.trim() ? obj.requestId : null,
    idempotent: obj.idempotent === true,
  };
}

export async function sendClientRequestToNoonApp(input: {
  projectId: string;
  externalRequestId: string;
  submittedBy: string;
  type: ClientRequestType;
  clientPriority: ClientRequestPriority;
  body: string;
  versionRef?: number | null;
  at?: string;
}) {
  return postNoonAppWebhook(
    "/api/integrations/website/client-request",
    buildClientRequestPayload(input),
  );
}

/**
 * Version Publish action (v3 Fase 2 versioning, Slice 2b). Forwards a client's
 * publish intent to App's receiver (`POST /api/integrations/website/version-action`)
 * and returns the resulting published state. camelCase wire (v3 family).
 *
 * MVP scope (frozen contract §3, co-signed 2026-06-18): `action` is `publish`
 * ONLY — rollback is staff-side App-internal and does NOT cross the wire. The App
 * de-dupes on `externalActionId` (app-level UNIQUE) and replies HTTP 200 on both
 * first-write and replay with `{ idempotent, publishedSequence, publishedUrl, requestId }`.
 * `at` is informational; the App orders by its own server clock.
 *
 * Unlike the §9 client-request path, NoonWeb does NOT persist a local outbox here:
 * the App is the sole source of truth for both the published STATE (surfaced via
 * the project-status pull) and the publish AUDIT (`project_activities`, contract
 * Q-D). The forward is synchronous — `postNoonAppWebhook` retries transient 5xx /
 * network failures (3 attempts) and throws on a deterministic 4xx, which the
 * caller surfaces to the client.
 */
export function buildVersionActionPayload(input: {
  projectId: string;
  versionSequenceNumber: number;
  externalActionId: string;
  at?: string;
}) {
  return {
    action: "publish" as const,
    projectId: input.projectId,
    versionSequenceNumber: input.versionSequenceNumber,
    externalActionId: input.externalActionId,
    at: input.at ?? new Date().toISOString(),
  };
}

/**
 * Best-effort extraction of App's publish-reply. Returns nulls/false for any
 * shape we don't recognise so a contract drift degrades gracefully instead of
 * throwing — the authoritative published state is always re-read from the pull
 * on the next render regardless.
 */
export function extractNoonAppVersionActionAck(response: unknown): {
  idempotent: boolean;
  publishedSequence: number | null;
  publishedUrl: string | null;
  requestId: string | null;
} {
  if (!response || typeof response !== "object") {
    return { idempotent: false, publishedSequence: null, publishedUrl: null, requestId: null };
  }
  const obj = response as {
    idempotent?: unknown;
    publishedSequence?: unknown;
    publishedUrl?: unknown;
    requestId?: unknown;
  };
  return {
    idempotent: obj.idempotent === true,
    publishedSequence:
      typeof obj.publishedSequence === "number" ? obj.publishedSequence : null,
    publishedUrl:
      typeof obj.publishedUrl === "string" && obj.publishedUrl.trim() ? obj.publishedUrl : null,
    requestId: typeof obj.requestId === "string" && obj.requestId.trim() ? obj.requestId : null,
  };
}

export async function sendVersionActionToNoonApp(input: {
  projectId: string;
  versionSequenceNumber: number;
  externalActionId: string;
  at?: string;
}) {
  return postNoonAppWebhook(
    "/api/integrations/website/version-action",
    buildVersionActionPayload(input),
  );
}

export const noonAppProposalReviewDecisionPayloadSchema = z.object({
  event: z.literal("proposal_review_decision"),
  decision: z.enum(["approved", "changes_requested", "rejected", "cancelled"]),
  external_source: z.string().min(1),
  external_session_id: z.string().min(1),
  external_proposal_id: z.string().min(1),
  noon_app: z
    .object({
      lead_id: z.string().optional(),
      proposal_id: z.string().optional(),
      reviewed_at: z.string().optional(),
      reviewer: z.unknown().optional(),
    })
    .optional(),
  proposal: z.object({
    title: z.string().min(1).optional(),
    body: z.string().min(1),
    amount: z.coerce.number().nonnegative(),
    currency: z.string().min(3).transform((value) => value.trim().toUpperCase()),
    review_status: z.string().optional(),
  }),
  customer: z.unknown().optional(),
});

/**
 * Inbound AI MVP pipeline milestone from App (handoff
 * 2026-06-06-noonweb-ai-mvp-milestones-handoff.md §4).
 *
 * §58 client-safe body — by construction this schema accepts ONLY the three
 * permitted fields. `version_url` is meaningful only on `version-ready`; on the
 * other kinds App omits it. We do not *reject* a stray null/url on the other
 * kinds (the receiver simply ignores it for non-`version-ready`), but we do
 * validate the URL shape when present so a malformed value is a 400, not a row.
 */
export const noonAppAiMvpMilestonePayloadSchema = z.object({
  event: z.literal("ai_mvp_milestone"),
  kind: z.enum(["started", "version-ready", "escalated"]),
  project_id: z.string().min(1),
  version_url: z.string().url().optional(),
});

/**
 * §9 client-request client-visible STATE push (App -> NoonWeb, Slice B). The App
 * collapses its 8 operational states to the 5 client-safe ones server-side; ONLY
 * those 5 cross the wire (§8.3). `.strict()` makes this an allowlist that REJECTS
 * any unmodeled key — so a leaked classification reason / operational priority /
 * escalation note is a 400, not a silently-stripped field. `revision` is the
 * App-authoritative monotonic guard (positive int); the receiver discards a push
 * whose revision does not advance. `at` is informational (ISO 8601).
 */
export const noonAppClientRequestStatePayloadSchema = z
  .object({
    externalRequestId: z.string().min(1),
    clientVisibleState: clientVisibleStateSchema,
    revision: z.number().int().positive(),
    at: z.string().min(1),
  })
  .strict();
