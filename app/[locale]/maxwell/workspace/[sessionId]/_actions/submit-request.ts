/**
 * app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-request.ts
 *
 * Server Action invoked by `RequestBox` (client component) when a client submits
 * a typed request from their workspace. Slice A of the v3 client-request system (§9).
 *
 * Flow (mirrors submit-comment.ts):
 *   1. Re-derive the viewer from the server session (NEVER trust the client) +
 *      re-check ownership of the studio session.
 *   2. Validate the typed fields locally (type/priority enums + body 1..4000) so
 *      the client gets a clean error instead of an App 400. Per-client rate-limit
 *      (NoonWeb owns it — the App receiver is server-to-server and trusts the HMAC).
 *   3. Gate (Q-10): the project must be payment-activated (mapped to an App
 *      project id) AND the cross-repo bridge configured. Unlike a comment, a
 *      request that can't reach the App has no operational meaning, so we do NOT
 *      persist an unroutable request.
 *   4. Derive the opaque `submittedBy` (HMAC of the email; never the email).
 *   5. Persist locally — the `client_request` outbox is the SOURCE OF TRUTH for
 *      the request log and the anchor for the App's client-visible state.
 *   6. Best-effort forward to App's receiver. A forward failure does NOT fail the
 *      action: the row stays a dead-letter (`forwarded_at IS NULL`) and we log it.
 *      `externalRequestId` (== the outbox row id) is reused verbatim so a retry
 *      de-dupes on App's side.
 */

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  createClientRequest,
  getClientWorkspaceBySession,
  getStudioSession,
  markClientRequestForwarded,
} from "@/lib/maxwell/repositories";
import {
  deriveSubmitterId,
  extractNoonAppRequestAck,
  isNoonAppProposalHandoffConfigured,
  sendClientRequestToNoonApp,
} from "@/lib/noon-app-integration";
import {
  CLIENT_REQUEST_BODY_MAX,
  isClientRequestPriority,
  isClientRequestType,
} from "@/lib/maxwell/client-requests";
import { enforceRateLimit, RateLimitExceededError } from "@/lib/server/rate-limit";
import { log } from "@/lib/server/logger";

export type SubmitRequestActionInput = {
  sessionId: string;
  type: string;
  clientPriority: string;
  body: string;
};

export type SubmitRequestActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      code: "UNAUTHENTICATED" | "NOT_FOUND" | "INVALID" | "RATE_LIMITED";
    };

export async function submitRequestAction(
  input: SubmitRequestActionInput,
): Promise<SubmitRequestActionResult> {
  const sessionData = await auth();
  const viewerEmail = sessionData?.user?.email?.trim().toLowerCase();
  if (!viewerEmail) {
    return { ok: false, error: "Please sign in to send a request.", code: "UNAUTHENTICATED" };
  }

  // Validate the typed fields BEFORE any forward so the client gets a clean
  // error, not an App 400. Capture into locals so the type-guard narrowing
  // survives the subsequent awaits.
  const requestType = input.type;
  const clientPriority = input.clientPriority;
  if (!isClientRequestType(requestType)) {
    return { ok: false, error: "Please choose a valid request type.", code: "INVALID" };
  }
  if (!isClientRequestPriority(clientPriority)) {
    return { ok: false, error: "Please choose a valid priority.", code: "INVALID" };
  }
  const body = input.body.trim();
  if (body.length < 1 || body.length > CLIENT_REQUEST_BODY_MAX) {
    return {
      ok: false,
      error: `Your request must be between 1 and ${CLIENT_REQUEST_BODY_MAX} characters.`,
      code: "INVALID",
    };
  }

  // Per-client rate-limit, keyed by the authenticated email. Burst of 5, ~1 / 10s.
  try {
    enforceRateLimit({
      namespace: "maxwell.client-request",
      capacity: 5,
      refillPerSec: 0.1,
      identityKey: viewerEmail,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        ok: false,
        error: "You're sending requests too quickly. Please wait a moment and try again.",
        code: "RATE_LIMITED",
      };
    }
    throw error;
  }

  const session = await getStudioSession(input.sessionId);
  if (!session || !viewerOwnsStudioSession({ email: viewerEmail }, session)) {
    return { ok: false, error: "We couldn't find that project.", code: "NOT_FOUND" };
  }

  const workspace = await getClientWorkspaceBySession(input.sessionId);
  if (!workspace) {
    return { ok: false, error: "Your workspace isn't ready yet.", code: "NOT_FOUND" };
  }

  // Gate (Q-10): a request needs a payment-activated project (mapped to an App
  // project id) AND the bridge configured — the latter also lets us derive the
  // opaque submitter id and forward. Without both, the request is unroutable, so
  // we refuse it rather than persist a row that can never reach the App.
  if (!workspace.noonAppProjectId || !isNoonAppProposalHandoffConfigured()) {
    return {
      ok: false,
      error: "Requests aren't available for this project yet.",
      code: "NOT_FOUND",
    };
  }

  const submittedBy = deriveSubmitterId(viewerEmail);

  // Persist locally — the outbox is the source of truth.
  const requestRow = await createClientRequest({
    clientWorkspaceId: workspace.id,
    type: requestType,
    clientPriority,
    body,
    submittedBy,
  });

  // Best-effort forward. Any failure is swallowed: the request persists as a
  // dead-letter and the client still sees it.
  try {
    const response = await sendClientRequestToNoonApp({
      projectId: workspace.noonAppProjectId,
      externalRequestId: requestRow.externalRequestId,
      submittedBy,
      type: requestRow.type,
      clientPriority: requestRow.clientPriority,
      body: requestRow.body,
      at: requestRow.createdAt,
    });
    const { requestId, idempotent } = extractNoonAppRequestAck(response);
    await markClientRequestForwarded(requestRow.id);
    log.info("maxwell.client-request", "Forwarded client request to App.", {
      request_id: requestRow.id,
      noon_app_request_id: requestId,
      idempotent,
    });
  } catch (error) {
    log.error("maxwell.client-request", error, {
      request_id: requestRow.id,
      workspace_id: workspace.id,
      stage: "forward",
    });
  }

  // force-dynamic page; revalidate so the new request appears in the log.
  revalidatePath("/[locale]/maxwell/workspace/[sessionId]", "page");
  return { ok: true };
}
