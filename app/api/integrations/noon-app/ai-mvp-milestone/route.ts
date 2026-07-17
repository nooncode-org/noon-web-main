import { NextResponse } from "next/server";
import {
  getClientWorkspaceByNoonAppProjectId,
  getLatestProposalRequest,
  getStudioSession,
  recordAiMvpMilestone,
} from "@/lib/maxwell/repositories";
import { sendMvpReadyEmail } from "@/lib/maxwell/lifecycle-emails";
import { buildWorkspaceUrl } from "@/lib/maxwell/public-url";
import { log } from "@/lib/server/logger";
import {
  NoonAppIntegrationError,
  noonAppAiMvpMilestonePayloadSchema,
  readSignedNoonAppJson,
} from "@/lib/noon-app-integration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * B8 #4 — best-effort "your first version is ready" email, fired when the
 * `version-ready` milestone is durably recorded for the FIRST time (`created`
 * gates it: the App's queue retries replay as a dedup no-op, so the email can
 * never double-send; Resend's idempotency key is the second belt).
 *
 * Mirrors the payment-activation lifecycle-email contract: everything is
 * wrapped so no failure here can leak into the webhook response — the App must
 * still get its 2xx once the milestone row is persisted.
 */
async function notifyMvpReadyBestEffort(input: {
  projectId: string;
  versionUrl: string | null;
}): Promise<void> {
  try {
    const workspace = await getClientWorkspaceByNoonAppProjectId(input.projectId);
    if (!workspace) {
      log.warn(
        "maxwell.lifecycle-email",
        "Skipped B8 #4 mvp-ready: no workspace mapped to project.",
        { project_id: input.projectId },
      );
      return;
    }

    const [session, proposal] = await Promise.all([
      getStudioSession(workspace.studioSessionId),
      getLatestProposalRequest(workspace.studioSessionId),
    ]);

    const recipient = proposal?.deliveryRecipient;
    if (!recipient) {
      log.warn(
        "maxwell.lifecycle-email",
        "Skipped B8 #4 mvp-ready: proposal has no delivery_recipient.",
        { project_id: input.projectId, session_id: workspace.studioSessionId },
      );
      return;
    }

    // The workspace link IS the email (same rule as B8 #3): if the public base
    // URL is unresolvable, skip rather than send a body with no destination.
    let workspaceUrl: string;
    try {
      workspaceUrl = buildWorkspaceUrl(workspace.studioSessionId, {
        locale: session?.language,
      });
    } catch (error) {
      log.warn(
        "maxwell.lifecycle-email",
        "Skipped B8 #4 mvp-ready: could not build workspace URL.",
        {
          session_id: workspace.studioSessionId,
          reason: error instanceof Error ? error.message : String(error),
        },
      );
      return;
    }

    const result = await sendMvpReadyEmail({
      projectId: input.projectId,
      to: recipient,
      projectTitle: session?.goalSummary?.trim() || "Your Noon project",
      workspaceUrl,
      previewUrl: input.versionUrl,
    });

    if (result.skipped) {
      log.info("maxwell.lifecycle-email", "B8 #4 mvp-ready skipped.", {
        reason: result.reason,
        project_id: input.projectId,
      });
    } else {
      log.info("maxwell.lifecycle-email", "B8 #4 mvp-ready sent.", {
        message_id: result.messageId,
        project_id: input.projectId,
      });
    }
  } catch (error) {
    log.error("maxwell.lifecycle-email", error, {
      stage: "mvp_ready",
      project_id: input.projectId,
    });
  }
}

/**
 * Receiver for App's post-payment AI MVP pipeline milestones (handoff
 * App-nooncode/docs/handoffs/2026-06-06-noonweb-ai-mvp-milestones-handoff.md).
 *
 * App emits client-safe milestones (`started` / `version-ready` / `escalated`)
 * over the same durable, HMAC-signed outbound queue that powers
 * proposal-review-decision (ADR-027). This endpoint:
 *
 *   1. Verifies the signature over the RAW request bytes (`readSignedNoonAppJson`
 *      reuses the exact scheme proposal-review-decision uses — `${ts}.${rawBody}`,
 *      ±5min skew, missing-timestamp rejected per the F-1 fix).
 *   2. Validates the §58 client-safe body (only kind / project_id / version_url).
 *   3. Persists idempotently on (project_id, kind) — App's queue retries on any
 *      non-2xx, so a repeat is a no-op upsert (handoff §5/§6).
 *   4. Returns 2xx only once the milestone is durably accepted, so App can mark
 *      the ledger row delivered.
 *   5. On a FIRST `version-ready`, best-effort notifies the client by email
 *      (B8 #4) — never blocks or fails the webhook.
 *
 * `version_url` is honoured only for `version-ready` (§4.2); on the other kinds
 * App omits it and we never persist one.
 */
export async function POST(request: Request) {
  try {
    const payload = await readSignedNoonAppJson(
      request,
      noonAppAiMvpMilestonePayloadSchema,
    );

    const versionUrl =
      payload.kind === "version-ready" ? payload.version_url ?? null : null;

    const { milestone, created } = await recordAiMvpMilestone({
      projectId: payload.project_id,
      kind: payload.kind,
      versionUrl,
    });

    if (created && payload.kind === "version-ready") {
      await notifyMvpReadyBestEffort({
        projectId: payload.project_id,
        versionUrl,
      });
    }

    return NextResponse.json({
      message: created
        ? "AI MVP milestone recorded."
        : "AI MVP milestone already recorded.",
      kind: milestone.kind,
      project_id: milestone.projectId,
      deduplicated: !created,
    });
  } catch (error) {
    if (error instanceof NoonAppIntegrationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    log.error("integrations.noon-app.ai-mvp-milestone", error);
    return NextResponse.json(
      { message: "Noon App AI MVP milestone webhook failed." },
      { status: 500 },
    );
  }
}
