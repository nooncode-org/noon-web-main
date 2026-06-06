import { NextResponse } from "next/server";
import { recordAiMvpMilestone } from "@/lib/maxwell/repositories";
import { log } from "@/lib/server/logger";
import {
  NoonAppIntegrationError,
  noonAppAiMvpMilestonePayloadSchema,
  readSignedNoonAppJson,
} from "@/lib/noon-app-integration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
