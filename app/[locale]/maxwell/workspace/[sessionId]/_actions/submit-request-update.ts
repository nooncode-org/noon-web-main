/**
 * app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-request-update.ts
 *
 * Server Action for the §9 clarification round-trip (B.5a). When a client replies
 * to one of their requests (typically one the App moved to Needs Clarification),
 * this persists the reply to the local `client_request_update` outbox and forwards
 * it to App's receiver (POST /api/integrations/website/client-request-update, §5D).
 *
 * Mirrors submit-request.ts:
 *   1. Re-derive the viewer from the session (NEVER trust the client) + ownership.
 *   2. Validate the body locally (1..4000). Per-client rate-limit.
 *   3. Gate (Q-10): payment-activated project (mapped to an App project id) AND
 *      the bridge configured — otherwise the reply is unroutable, so we refuse it.
 *   4. Scope the parent request to the viewer's workspace (never trust the id).
 *   5. Persist locally — the outbox is the durable record + dead-letter anchor.
 *   6. Best-effort forward; `updateId` (== the outbox row id) is reused verbatim so
 *      a retry de-dupes on App's `(externalRequestId, updateId)`.
 *
 * `kind` is always `clarification` — the only kind the App supports today
 * (`attachment` is B.5b, deferred behind file-hosting).
 */

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  createClientRequestUpdate,
  getClientRequestForWorkspace,
  getClientWorkspaceBySession,
  getStudioSession,
  markClientRequestUpdateForwarded,
} from "@/lib/maxwell/repositories";
import {
  extractNoonAppRequestUpdateAck,
  isNoonAppProposalHandoffConfigured,
  sendClientRequestUpdateToNoonApp,
} from "@/lib/noon-app-integration";
import { CLIENT_REQUEST_BODY_MAX } from "@/lib/maxwell/client-requests";
import { enforceRateLimit, RateLimitExceededError } from "@/lib/server/rate-limit";
import { log } from "@/lib/server/logger";

export type SubmitRequestUpdateActionInput = {
  sessionId: string;
  requestId: string;
  body: string;
};

export type SubmitRequestUpdateActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      code: "UNAUTHENTICATED" | "NOT_FOUND" | "INVALID" | "RATE_LIMITED";
    };

export async function submitRequestUpdateAction(
  input: SubmitRequestUpdateActionInput,
): Promise<SubmitRequestUpdateActionResult> {
  const sessionData = await auth();
  const viewerEmail = sessionData?.user?.email?.trim().toLowerCase();
  if (!viewerEmail) {
    return { ok: false, error: "Please sign in to reply.", code: "UNAUTHENTICATED" };
  }

  const body = input.body.trim();
  if (body.length < 1 || body.length > CLIENT_REQUEST_BODY_MAX) {
    return {
      ok: false,
      error: `Your reply must be between 1 and ${CLIENT_REQUEST_BODY_MAX} characters.`,
      code: "INVALID",
    };
  }

  // Per-client rate-limit, keyed by the authenticated email. Burst of 5, ~1 / 10s.
  try {
    enforceRateLimit({
      namespace: "maxwell.client-request-update",
      capacity: 5,
      refillPerSec: 0.1,
      identityKey: viewerEmail,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        ok: false,
        error: "You're sending replies too quickly. Please wait a moment and try again.",
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

  // Gate (Q-10 parity): a reply needs a payment-activated project (mapped to an
  // App project id) AND the bridge configured — otherwise it is unroutable.
  if (!workspace.noonAppProjectId || !isNoonAppProposalHandoffConfigured()) {
    return {
      ok: false,
      error: "Replies aren't available for this project yet.",
      code: "NOT_FOUND",
    };
  }

  // Scope the parent request to this workspace — never trust the client's id.
  const parent = await getClientRequestForWorkspace(input.requestId, workspace.id);
  if (!parent) {
    return { ok: false, error: "We couldn't find that request.", code: "NOT_FOUND" };
  }

  // Persist locally — the outbox is the durable record.
  const updateRow = await createClientRequestUpdate({
    clientRequestId: parent.id,
    kind: "clarification",
    body,
  });

  // Best-effort forward. A failure leaves a dead-letter (forwarded_at NULL).
  try {
    const response = await sendClientRequestUpdateToNoonApp({
      externalRequestId: parent.externalRequestId,
      updateId: updateRow.externalUpdateId,
      body: updateRow.body,
      kind: "clarification",
      at: updateRow.createdAt,
    });
    const { updateId, idempotent } = extractNoonAppRequestUpdateAck(response);
    await markClientRequestUpdateForwarded(updateRow.id);
    log.info("maxwell.client-request-update", "Forwarded clarification to App.", {
      request_id: parent.id,
      update_id: updateRow.id,
      noon_app_update_id: updateId,
      idempotent,
    });
  } catch (error) {
    log.error("maxwell.client-request-update", error, {
      request_id: parent.id,
      update_id: updateRow.id,
      workspace_id: workspace.id,
      stage: "forward",
    });
  }

  // force-dynamic page; revalidate so the new reply appears under the request.
  revalidatePath("/[locale]/maxwell/workspace/[sessionId]", "page");
  return { ok: true };
}
