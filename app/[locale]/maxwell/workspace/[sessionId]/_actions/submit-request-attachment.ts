/**
 * app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-request-attachment.ts
 *
 * Server Action for §9 B.5b attachments. A client attaches a file to one of their
 * requests; NoonWeb hosts the bytes in a PRIVATE Supabase Storage bucket and
 * forwards a `client-request-update` with `kind:'attachment'` carrying a stable
 * reference (never a URL). Staff fetch later via the HMAC signed-read.
 *
 * Mirrors submit-request-update.ts:
 *   1. Gate on ATTACHMENTS_ENABLED (hard deploy order — the App 400s attachments
 *      until its branch ships) + auth + body/mime/size validation.
 *   2. Per-client rate-limit; ownership; payment-activated + bridge + storage gate.
 *   3. Scope the parent request to the viewer's workspace.
 *   4. Upload bytes to Storage, persist the outbox row (durable record), forward
 *      the reference best-effort (dead-letter on failure; updateId == row id reused
 *      on retry → App de-dupes on (externalRequestId, updateId)).
 *
 * `body` is the OPTIONAL note accompanying the file.
 */

"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  createClientRequestAttachment,
  getClientRequestForWorkspace,
  getClientWorkspaceBySession,
  getStudioSession,
  markClientRequestAttachmentForwarded,
} from "@/lib/maxwell/repositories";
import {
  extractNoonAppRequestUpdateAck,
  isNoonAppProposalHandoffConfigured,
  sendClientRequestAttachmentToNoonApp,
} from "@/lib/noon-app-integration";
import {
  ATTACHMENTS_ENABLED,
  isAllowedAttachmentMime,
  isValidAttachmentSize,
  sanitizeAttachmentFilename,
} from "@/lib/maxwell/attachments";
import { CLIENT_REQUEST_BODY_MAX } from "@/lib/maxwell/client-requests";
import {
  isAttachmentStorageConfigured,
  uploadAttachmentObject,
} from "@/lib/maxwell/attachment-storage";
import { enforceRateLimit, RateLimitExceededError } from "@/lib/server/rate-limit";
import { log } from "@/lib/server/logger";

export type SubmitRequestAttachmentActionInput = {
  sessionId: string;
  requestId: string;
  file: File;
  body?: string | null;
};

export type SubmitRequestAttachmentActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      code: "UNAUTHENTICATED" | "NOT_FOUND" | "INVALID" | "RATE_LIMITED";
    };

export async function submitRequestAttachmentAction(
  input: SubmitRequestAttachmentActionInput,
): Promise<SubmitRequestAttachmentActionResult> {
  // B.5b gate: the App 400s kind:'attachment' until its branch ships. Defense in
  // depth — the UI also hides the picker while the flag is false.
  if (!ATTACHMENTS_ENABLED) {
    return { ok: false, error: "Attachments aren't available yet.", code: "INVALID" };
  }

  const sessionData = await auth();
  const viewerEmail = sessionData?.user?.email?.trim().toLowerCase();
  if (!viewerEmail) {
    return { ok: false, error: "Please sign in to attach a file.", code: "UNAUTHENTICATED" };
  }

  const file = input.file;
  if (!file || typeof file.arrayBuffer !== "function") {
    return { ok: false, error: "Please choose a file.", code: "INVALID" };
  }
  if (!isAllowedAttachmentMime(file.type)) {
    return { ok: false, error: "That file type isn't allowed.", code: "INVALID" };
  }
  if (!isValidAttachmentSize(file.size)) {
    return { ok: false, error: "That file is too large (max 10 MB).", code: "INVALID" };
  }

  // Optional note accompanying the file.
  const rawBody = input.body?.trim() ?? "";
  if (rawBody.length > CLIENT_REQUEST_BODY_MAX) {
    return {
      ok: false,
      error: `Your note must be at most ${CLIENT_REQUEST_BODY_MAX} characters.`,
      code: "INVALID",
    };
  }
  const body = rawBody.length > 0 ? rawBody : null;

  try {
    enforceRateLimit({
      namespace: "maxwell.client-request-attachment",
      capacity: 5,
      refillPerSec: 0.1,
      identityKey: viewerEmail,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        ok: false,
        error: "You're attaching files too quickly. Please wait a moment and try again.",
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

  // Gate (Q-10 parity): payment-activated project + bridge configured + storage
  // configured — otherwise the attachment is unroutable/unhostable.
  if (
    !workspace.noonAppProjectId ||
    !isNoonAppProposalHandoffConfigured() ||
    !isAttachmentStorageConfigured()
  ) {
    return { ok: false, error: "Attachments aren't available for this project yet.", code: "NOT_FOUND" };
  }

  const parent = await getClientRequestForWorkspace(input.requestId, workspace.id);
  if (!parent) {
    return { ok: false, error: "We couldn't find that request.", code: "NOT_FOUND" };
  }

  const filename = sanitizeAttachmentFilename(file.name);
  // Random key segment → unique + unguessable; never derived from client input alone.
  const blobKey = `${workspace.id}/${randomUUID()}/${filename}`;

  // Upload first so the persisted row never points at a missing object.
  const bytes = await file.arrayBuffer();
  await uploadAttachmentObject({ key: blobKey, body: bytes, contentType: file.type });

  // Persist locally — the outbox is the durable record.
  const attachment = await createClientRequestAttachment({
    clientRequestId: parent.id,
    blobKey,
    filename,
    mime: file.type,
    sizeBytes: file.size,
    body,
  });

  // Best-effort forward. A failure leaves a dead-letter (forwarded_at NULL).
  try {
    const response = await sendClientRequestAttachmentToNoonApp({
      externalRequestId: parent.externalRequestId,
      updateId: attachment.externalUpdateId,
      attachment: {
        id: attachment.id,
        filename: attachment.filename,
        mime: attachment.mime,
        size: attachment.sizeBytes,
      },
      body: attachment.body,
      at: attachment.createdAt,
    });
    const { updateId, idempotent } = extractNoonAppRequestUpdateAck(response);
    await markClientRequestAttachmentForwarded(attachment.id);
    log.info("maxwell.client-request-attachment", "Forwarded attachment to App.", {
      request_id: parent.id,
      attachment_id: attachment.id,
      noon_app_update_id: updateId,
      idempotent,
    });
  } catch (error) {
    log.error("maxwell.client-request-attachment", error, {
      request_id: parent.id,
      attachment_id: attachment.id,
      workspace_id: workspace.id,
      stage: "forward",
    });
  }

  revalidatePath("/[locale]/maxwell/workspace/[sessionId]", "page");
  return { ok: true };
}
