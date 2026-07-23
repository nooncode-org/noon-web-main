/**
 * app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-version-action.ts
 *
 * Server Action invoked by `VersionPublishButton` when a client publishes one of
 * their project versions from the workspace. Slice 2b of the v3 Fase 2 versioning
 * system (frozen contract §3, co-signed 2026-06-18).
 *
 * Authorship (Q-A): Publish is CLIENT self-service. Rollback is staff-side and
 * App-internal — it does NOT cross the wire, so this action only ever sends
 * `action: "publish"`.
 *
 * Flow (mirrors submit-request.ts, minus the local outbox):
 *   1. Re-derive the viewer from the server session (NEVER trust the client) +
 *      re-check ownership of the studio session.
 *   2. Per-client rate-limit (NoonWeb owns it — the App receiver is
 *      server-to-server and trusts the HMAC).
 *   3. Validate `versionSequenceNumber` locally so the client gets a clean error
 *      instead of an App 400.
 *   4. Gate: the project must be payment-activated (mapped to an App project id)
 *      AND the cross-repo bridge configured — otherwise the publish is unroutable.
 *   5. Forward SYNCHRONOUSLY to App's receiver, keyed by a per-attempt
 *      `externalActionId` (UUID, reused across postNoonAppWebhook's internal
 *      retries → App de-dupes). Unlike a client-request, NoonWeb persists NOTHING:
 *      the App is the sole source of truth for the published state (surfaced via
 *      the project-status pull) and the publish audit (`project_activities`, Q-D).
 *   6. On success, revalidate so the pull re-renders with the new published state.
 *      On failure, surface a clean error — the client can retry (a fresh attempt).
 *
 * Project-type gate (web / web-app only, Q-C) is enforced authoritatively by the
 * App receiver; the project-status pull does not expose the project type, so a
 * non-publishable target is rejected server-side and surfaced here as a clean error.
 */

"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  getClientWorkspaceBySession,
  getLatestProposalRequest,
  getStudioSession,
} from "@/lib/maxwell/repositories";
import {
  extractNoonAppVersionActionAck,
  isNoonAppProposalHandoffConfigured,
  sendVersionActionToNoonApp,
} from "@/lib/noon-app-integration";
import { enforceRateLimit, RateLimitExceededError } from "@/lib/server/rate-limit";
import { log } from "@/lib/server/logger";

export type SubmitVersionActionInput = {
  sessionId: string;
  versionSequenceNumber: number;
};

export type SubmitVersionActionResult =
  | {
      ok: true;
      publishedSequence: number | null;
      publishedUrl: string | null;
      idempotent: boolean;
    }
  | {
      ok: false;
      error: string;
      code:
        | "UNAUTHENTICATED"
        | "NOT_FOUND"
        | "INVALID"
        | "RATE_LIMITED"
        | "PLAN_NOT_ALLOWED"
        | "FORWARD_FAILED";
    };

export async function submitVersionAction(
  input: SubmitVersionActionInput,
): Promise<SubmitVersionActionResult> {
  const sessionData = await auth();
  const viewerEmail = sessionData?.user?.email?.trim().toLowerCase();
  if (!viewerEmail) {
    return { ok: false, error: "Please sign in to publish a version.", code: "UNAUTHENTICATED" };
  }

  // Validate the target version locally so the client gets a clean error, not an
  // App 400. The App resolves (projectId, versionSequenceNumber) -> row; the
  // sequence is a positive integer.
  const sequence = input.versionSequenceNumber;
  if (!Number.isInteger(sequence) || sequence < 1) {
    return { ok: false, error: "Please choose a valid version to publish.", code: "INVALID" };
  }

  // Per-client rate-limit, keyed by the authenticated email. Publish is a
  // deliberate action — a small burst with a slow refill.
  try {
    enforceRateLimit({
      namespace: "maxwell.version-action",
      capacity: 5,
      refillPerSec: 0.1,
      identityKey: viewerEmail,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        ok: false,
        error: "You're publishing too quickly. Please wait a moment and try again.",
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

  // Plan gate: publishing is a BUILD decision — a one-time buyer's versions are
  // read-only (owner 2026-07-22), the team ships their delivery. The portal
  // hides the action; this is the lock behind it (a Server Action is public).
  const proposal = await getLatestProposalRequest(input.sessionId);
  if (proposal?.paymentModality === "one_time") {
    return {
      ok: false,
      error:
        "Your project is a one-time build, so your Noon team handles publishing. Add a membership to ship changes yourself.",
      code: "PLAN_NOT_ALLOWED",
    };
  }

  // Gate (Q-10 parity): a publish needs a payment-activated project (mapped to an
  // App project id) AND the bridge configured. Without both it is unroutable.
  if (!workspace.noonAppProjectId || !isNoonAppProposalHandoffConfigured()) {
    return {
      ok: false,
      error: "Publishing isn't available for this project yet.",
      code: "NOT_FOUND",
    };
  }

  // One id per attempt, reused across postNoonAppWebhook's internal retries so the
  // App de-dupes a retried publish. A failed attempt = the client retries (a fresh id).
  const externalActionId = randomUUID();

  try {
    const response = await sendVersionActionToNoonApp({
      projectId: workspace.noonAppProjectId,
      versionSequenceNumber: sequence,
      externalActionId,
    });
    const ack = extractNoonAppVersionActionAck(response);
    log.info("maxwell.version-action", "Published version via App.", {
      workspace_id: workspace.id,
      version_sequence_number: sequence,
      external_action_id: externalActionId,
      published_sequence: ack.publishedSequence,
      idempotent: ack.idempotent,
      noon_app_request_id: ack.requestId,
    });

    // force-dynamic page; revalidate so the published state (pull) re-renders.
    revalidatePath("/[locale]/maxwell/workspace/[sessionId]", "page");
    return {
      ok: true,
      publishedSequence: ack.publishedSequence,
      publishedUrl: ack.publishedUrl,
      idempotent: ack.idempotent,
    };
  } catch (error) {
    log.error("maxwell.version-action", error, {
      workspace_id: workspace.id,
      version_sequence_number: sequence,
      external_action_id: externalActionId,
      stage: "forward",
    });
    return {
      ok: false,
      error: "We couldn't publish that version right now. Please try again in a moment.",
      code: "FORWARD_FAILED",
    };
  }
}
