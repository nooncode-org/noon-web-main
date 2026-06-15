/**
 * app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-comment.ts
 *
 * Server Action invoked by `CommentBox` (client component) when the client sends
 * a message from their workspace. Slice 1b of the v3 client portal.
 *
 * Flow:
 *   1. Re-derive the viewer from the server session (NEVER trust the client) +
 *      re-check ownership of the studio session.
 *   2. Per-client rate-limit (NoonWeb owns it — the App receiver is
 *      server-to-server and trusts the HMAC). Validate the body locally so the
 *      client gets a clean error instead of an App 400.
 *   3. Persist locally — the `client_comment` outbox is the SOURCE OF TRUTH for
 *      the client's message log (the status read does not return comments).
 *   4. Best-effort forward to App's receiver. A forward failure does NOT fail
 *      the action: the comment is saved + shown, the row stays a dead-letter
 *      (`forwarded_at IS NULL`), and we log it. `externalCommentId` (== the
 *      outbox row id) is reused verbatim so a retry de-dupes on App's side.
 */

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  createClientComment,
  getClientWorkspaceBySession,
  getStudioSession,
  markClientCommentForwarded,
} from "@/lib/maxwell/repositories";
import {
  extractNoonAppCommentId,
  isNoonAppProposalHandoffConfigured,
  sendClientCommentToNoonApp,
} from "@/lib/noon-app-integration";
import { enforceRateLimit, RateLimitExceededError } from "@/lib/server/rate-limit";
import { log } from "@/lib/server/logger";

const MAX_COMMENT_LENGTH = 2000;

export type SubmitCommentActionInput = {
  sessionId: string;
  body: string;
};

export type SubmitCommentActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      code: "UNAUTHENTICATED" | "NOT_FOUND" | "INVALID" | "RATE_LIMITED";
    };

export async function submitCommentAction(
  input: SubmitCommentActionInput,
): Promise<SubmitCommentActionResult> {
  const sessionData = await auth();
  const viewerEmail = sessionData?.user?.email?.trim().toLowerCase();
  if (!viewerEmail) {
    return { ok: false, error: "Please sign in to send a message.", code: "UNAUTHENTICATED" };
  }

  // Validate BEFORE any forward so the client gets a clean error, not an App 400.
  const body = input.body.trim();
  if (body.length < 1 || body.length > MAX_COMMENT_LENGTH) {
    return {
      ok: false,
      error: `Your message must be between 1 and ${MAX_COMMENT_LENGTH} characters.`,
      code: "INVALID",
    };
  }

  // Per-client rate-limit, keyed by the authenticated email. Burst of 5, ~1 / 10s.
  try {
    enforceRateLimit({
      namespace: "maxwell.client-comment",
      capacity: 5,
      refillPerSec: 0.1,
      identityKey: viewerEmail,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        ok: false,
        error: "You're sending messages too quickly. Please wait a moment and try again.",
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

  // 1. Persist locally — the outbox is the source of truth for the client's log.
  const comment = await createClientComment({ clientWorkspaceId: workspace.id, body });

  // 2. Best-effort forward. Only when the workspace is mapped to an App project
  //    AND the cross-repo bridge is configured. Any failure is swallowed: the
  //    comment persists as a dead-letter and the client still sees it.
  if (workspace.noonAppProjectId && isNoonAppProposalHandoffConfigured()) {
    try {
      const response = await sendClientCommentToNoonApp({
        projectId: workspace.noonAppProjectId,
        externalCommentId: comment.externalCommentId,
        body: comment.body,
        at: comment.createdAt,
      });
      const { commentId, idempotent } = extractNoonAppCommentId(response);
      await markClientCommentForwarded(comment.id, commentId);
      log.info("maxwell.client-comment", "Forwarded client comment to App.", {
        comment_id: comment.id,
        noon_app_comment_id: commentId,
        idempotent,
      });
    } catch (error) {
      // 4xx is deterministic, 5xx/network exhausted its retries inside
      // postNoonAppWebhook — either way the row is a dead-letter for a later
      // sweep. Surface to the logger; do NOT fail the client's action.
      log.error("maxwell.client-comment", error, {
        comment_id: comment.id,
        workspace_id: workspace.id,
        stage: "forward",
      });
    }
  } else {
    log.warn(
      "maxwell.client-comment",
      "Saved client comment without forwarding (no project mapping or bridge unconfigured).",
      {
        comment_id: comment.id,
        workspace_id: workspace.id,
        has_project_id: Boolean(workspace.noonAppProjectId),
      },
    );
  }

  // force-dynamic page, but revalidate so the in-flight transition re-renders
  // with the new message appended to the log.
  revalidatePath("/[locale]/maxwell/workspace/[sessionId]", "page");
  return { ok: true };
}
