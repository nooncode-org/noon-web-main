import { NextResponse } from "next/server";
import {
  getClientWorkspaceByNoonAppProjectId,
  getLatestProposalRequest,
  getStudioSession,
  recordAiMvpMilestone,
} from "@/lib/maxwell/repositories";
import { sendMvpEscalatedEmail, sendMvpReadyEmail } from "@/lib/maxwell/lifecycle-emails";
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
 * Shared resolution for the milestone-triggered client emails (B8 #4
 * `version-ready` + `escalated`): App project id → the client's recipient +
 * workspace URL + project title, or `null` (with a scoped `label` log) when any
 * hop is missing. Never throws — the caller wraps the send so no failure leaks
 * into the webhook's 2xx.
 */
async function resolveMilestoneEmailContext(
  projectId: string,
  label: string,
): Promise<{ recipient: string; workspaceUrl: string; projectTitle: string } | null> {
  const workspace = await getClientWorkspaceByNoonAppProjectId(projectId);
  if (!workspace) {
    log.warn("maxwell.lifecycle-email", `Skipped ${label}: no workspace mapped to project.`, {
      project_id: projectId,
    });
    return null;
  }

  const [session, proposal] = await Promise.all([
    getStudioSession(workspace.studioSessionId),
    getLatestProposalRequest(workspace.studioSessionId),
  ]);

  const recipient = proposal?.deliveryRecipient;
  if (!recipient) {
    log.warn("maxwell.lifecycle-email", `Skipped ${label}: proposal has no delivery_recipient.`, {
      project_id: projectId,
      session_id: workspace.studioSessionId,
    });
    return null;
  }

  // The workspace link IS the email (same rule as B8 #3): if the public base
  // URL is unresolvable, skip rather than send a body with no destination.
  let workspaceUrl: string;
  try {
    workspaceUrl = buildWorkspaceUrl(workspace.studioSessionId, {
      locale: session?.language,
    });
  } catch (error) {
    log.warn("maxwell.lifecycle-email", `Skipped ${label}: could not build workspace URL.`, {
      session_id: workspace.studioSessionId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  return {
    recipient,
    workspaceUrl,
    projectTitle: session?.goalSummary?.trim() || "Your Noon project",
  };
}

/**
 * B8 #4 — best-effort "your first version is ready" email, fired when the
 * `version-ready` milestone is durably recorded for the FIRST time (`created`
 * gates it: the App's queue retries replay as a dedup no-op, so the email can
 * never double-send; Resend's idempotency key is the second belt).
 *
 * Everything is wrapped so no failure here can leak into the webhook response —
 * the App must still get its 2xx once the milestone row is persisted.
 */
async function notifyMvpReadyBestEffort(input: {
  projectId: string;
  versionUrl: string | null;
}): Promise<void> {
  try {
    const ctx = await resolveMilestoneEmailContext(input.projectId, "B8 #4 mvp-ready");
    if (!ctx) return;

    const result = await sendMvpReadyEmail({
      projectId: input.projectId,
      to: ctx.recipient,
      projectTitle: ctx.projectTitle,
      workspaceUrl: ctx.workspaceUrl,
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
 * Best-effort "a Noon specialist is on your project" reassurance email, fired
 * when the `escalated` milestone is recorded for the FIRST time (the AI pipeline
 * handed the project to a human). Same wrapped, never-blocks-the-2xx contract as
 * the version-ready notifier above.
 */
async function notifyMvpEscalatedBestEffort(input: { projectId: string }): Promise<void> {
  try {
    const ctx = await resolveMilestoneEmailContext(input.projectId, "escalated");
    if (!ctx) return;

    const result = await sendMvpEscalatedEmail({
      projectId: input.projectId,
      to: ctx.recipient,
      projectTitle: ctx.projectTitle,
      workspaceUrl: ctx.workspaceUrl,
    });

    if (result.skipped) {
      log.info("maxwell.lifecycle-email", "Escalated email skipped.", {
        reason: result.reason,
        project_id: input.projectId,
      });
    } else {
      log.info("maxwell.lifecycle-email", "Escalated email sent.", {
        message_id: result.messageId,
        project_id: input.projectId,
      });
    }
  } catch (error) {
    log.error("maxwell.lifecycle-email", error, {
      stage: "mvp_escalated",
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
 *   5. On a FIRST `version-ready`, best-effort emails the client "your first
 *      version is ready" (B8 #4); on a FIRST `escalated`, best-effort emails the
 *      reassuring "a specialist is on your project". Neither blocks/fails the 2xx.
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
    } else if (created && payload.kind === "escalated") {
      await notifyMvpEscalatedBestEffort({ projectId: payload.project_id });
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
