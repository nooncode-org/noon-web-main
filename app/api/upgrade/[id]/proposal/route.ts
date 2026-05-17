/**
 * POST /api/upgrade/[id]/proposal
 * Request a formal proposal directly from the /upgrade module.
 *
 * Flow:
 *   1. Do the Maxwell handoff (creates studio_session with upgrade context)
 *   2. Set studio_session to 'approved_for_proposal' (upgrade has done the equivalent work)
 *   3. Generate proposal content using Maxwell's proposal logic
 *   4. Create proposal_request (enters review panel — official Noon flow)
 *   5. Mark upgrade session as 'proposal_sent'
 *
 * source = website_upgrade is tracked via website_upgrade_event + the handoff prompt.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { log } from "@/lib/server/logger";
import {
  getUpgradeSessionById,
  getAuditBySessionId,
  getLatestVersionBySessionId,
  updateSessionStatus,
  insertUpgradeEvent,
} from "@/lib/upgrade/repositories";
import {
  updateStudioSessionStatus,
  getStudioMessagesForOpenAI,
  getStudioVersions,
  createProposalRequest,
  appendProposalReviewEvent,
  appendStudioMessage,
  type StudioSession,
} from "@/lib/maxwell/repositories";
import { MAXWELL_PROPOSAL_SYSTEM_PROMPT } from "@/lib/maxwell/prompts";
import {
  buildProposalContext,
  resolveProposalCommercialProfile,
  validateProposalDraft,
} from "@/lib/maxwell/proposal-rules";
import { classifyProposalCase } from "@/lib/maxwell/proposal-lifecycle";
import { stripInternalReviewFlags } from "@/lib/maxwell/proposal-content";
import { chatWithOpenAI } from "@/lib/api-ia";
import { getDb } from "@/lib/server/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const viewer = await getAuthenticatedViewer();
    if (!viewer) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const session = await getUpgradeSessionById(id);
    if (!session || session.ownerEmail !== viewer.email) {
      return NextResponse.json({ message: "Session not found." }, { status: 404 });
    }

    if (session.status !== "version_ready") {
      return NextResponse.json(
        { message: "The upgraded version must be ready before requesting a proposal." },
        { status: 422 }
      );
    }

    const [audit, latestVersion] = await Promise.all([
      getAuditBySessionId(id),
      getLatestVersionBySessionId(id),
    ]);

    if (!audit || !latestVersion) {
      return NextResponse.json(
        { message: "Audit and upgraded version are required." },
        { status: 422 }
      );
    }

    // ── 1. Create studio_session at approved_for_proposal ────────────────────
    const sql = getDb();
    const studioSessionId = randomUUID();
    const ts = new Date().toISOString();

    // Build the upgrade-context prompt (same as handoff)
    const v = latestVersion.versionJson;
    const a = audit.auditJson;
    const contextPrompt = buildUpgradeContextPrompt(session.websiteUrlRaw, a, v);

    await sql`
      INSERT INTO studio_session (
        id, initial_prompt, status,
        owner_email, owner_name, owner_image,
        corrections_used, max_corrections,
        language,
        created_at, updated_at
      ) VALUES (
        ${studioSessionId},
        ${contextPrompt},
        'approved_for_proposal',
        ${viewer.email},
        ${viewer.name ?? null},
        ${viewer.image ?? null},
        0, 2,
        'en',
        ${ts}, ${ts}
      )
    `;

    // Log session creation event
    await sql`
      INSERT INTO studio_event (
        id, studio_session_id, event_type, actor, payload_json, created_at
      ) VALUES (
        ${randomUUID()}, ${studioSessionId},
        'session_created', ${viewer.email},
        ${JSON.stringify({ source: "website_upgrade", upgradeSessionId: id })}::jsonb,
        ${ts}
      )
    `;

    // ── 2. Generate proposal content using Maxwell's logic ───────────────────
    const dbMessages = await getStudioMessagesForOpenAI(studioSessionId);
    const dbVersions = await getStudioVersions(studioSessionId);

    // Retrieve the full StudioSession row so Maxwell's helpers can use it
    const studioRows = await sql<StudioSession[]>`
      SELECT
        id, initial_prompt AS "initialPrompt", status,
        owner_email AS "ownerEmail", owner_name AS "ownerName", owner_image AS "ownerImage",
        project_type AS "projectType", goal_summary AS "goalSummary",
        complexity_hint AS "complexityHint", language,
        corrections_used AS "correctionsUsed", max_corrections AS "maxCorrections",
        proposal_requested_at AS "proposalRequestedAt",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM studio_session WHERE id = ${studioSessionId}
    `;

    const studioSession = studioRows[0];
    const richContext = buildProposalContext(studioSession, dbMessages, dbVersions);
    const commercialProfile = resolveProposalCommercialProfile(studioSession);

    const { reply: draftContent } = await chatWithOpenAI({
      prompt: richContext,
      systemPrompt: MAXWELL_PROPOSAL_SYSTEM_PROMPT,
    });

    const warnings = validateProposalDraft(draftContent, {
      membershipRecommended: commercialProfile.membershipRecommended,
      requireFlexibleOption: true,
    });

    // ── 3. Create proposal_request (enters review panel) ─────────────────────
    await updateStudioSessionStatus(studioSessionId, "proposal_pending_review", {
      proposalRequestedAt: ts,
    });

    const proposalRequest = await createProposalRequest({
      studioSessionId,
      draftContent: stripInternalReviewFlags(draftContent),
      caseClassification: classifyProposalCase({ warningCount: warnings.length }),
      deliveryRecipient: viewer.email,
    });

    if (warnings.length > 0) {
      await appendProposalReviewEvent({
        proposalRequestId: proposalRequest.id,
        action: "review_flags_detected",
        actor: "maxwell",
        notes: warnings.join("\n"),
      });
    }

    await appendStudioMessage({
      studioSessionId,
      role: "user",
      content: "Formal proposal requested via Upgrade Your Website.",
      messageType: "proposal_request",
    });

    // ── 4. Mark upgrade session as proposal_sent ──────────────────────────────
    await updateSessionStatus(id, "proposal_sent");
    await insertUpgradeEvent({
      sessionId: id,
      eventType: "proposal_requested",
      metadata: { proposalRequestId: proposalRequest.id, studioSessionId },
    });

    return NextResponse.json(
      { proposalRequestId: proposalRequest.id, status: "proposal_sent" },
      { status: 200 }
    );
  } catch (error) {
    log.error("upgrade.proposal", error);
    return NextResponse.json({ message: "Failed to create proposal." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------

function buildUpgradeContextPrompt(
  websiteUrl: string,
  a: { overallScore: number; criticalIssues: string[]; topRecommendations: string[] },
  v: { headline: string; subheadline: string; valueProposition: string; ctaText: string; keyChanges: string[]; toneGuidance: string }
): string {
  return `Website upgrade request for ${websiteUrl}.

Audit score: ${a.overallScore}/10
Critical issues: ${a.criticalIssues.join("; ")}
Top recommendations: ${a.topRecommendations.join("; ")}

Upgraded direction:
- Headline: "${v.headline}"
- Subheadline: "${v.subheadline}"
- Value proposition: ${v.valueProposition}
- CTA: "${v.ctaText}"
- Key changes: ${v.keyChanges.join("; ")}
- Tone: ${v.toneGuidance}

Client wants a full proposal to rebuild their website implementing these improvements.`;
}
