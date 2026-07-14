/**
 * POST /api/upgrade/[id]/handoff
 * Transfer the complete /upgrade session context to Maxwell Studio.
 * Creates a new studio_session pre-loaded with audit + upgraded version context.
 *
 * Technical decision (documented per spec addendum §3):
 *   Payload: initial_prompt = structured summary of audit + upgraded version.
 *   The website_upgrade_session.id is stored in the studio event metadata.
 *   The studio session starts in 'intake' status — Maxwell takes it from there.
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
import { getDb } from "@/lib/server/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        { message: "The upgraded version must be ready before continuing with Maxwell." },
        { status: 422 }
      );
    }

    const [audit, latestVersion] = await Promise.all([
      getAuditBySessionId(id),
      getLatestVersionBySessionId(id),
    ]);

    if (!audit || !latestVersion) {
      return NextResponse.json(
        { message: "Audit and upgraded version are required for the handoff." },
        { status: 422 }
      );
    }

    // ── Build the handoff prompt ────────────────────────────────────────────
    // This becomes the initial_prompt for the Maxwell studio session.
    const v = latestVersion.versionJson;
    const a = audit.auditJson;

    const handoffPrompt = buildHandoffPrompt(
      session.websiteUrlRaw,
      a.overallScore,
      a.criticalIssues,
      a.topRecommendations,
      v.headline,
      v.subheadline,
      v.valueProposition,
      v.ctaText,
      v.keyChanges,
      v.toneGuidance
    );

    // ── Create a new Maxwell studio session ────────────────────────────────
    const sql = getDb();
    const studioSessionId = randomUUID();
    const ts = new Date().toISOString();

    await sql`
      INSERT INTO studio_session (
        id, initial_prompt, status,
        owner_email, owner_name, owner_image,
        corrections_used, max_corrections,
        language,
        created_at, updated_at
      ) VALUES (
        ${studioSessionId},
        ${handoffPrompt},
        'intake',
        ${viewer.email},
        ${viewer.name ?? null},
        ${viewer.image ?? null},
        0, 2,
        'en',
        ${ts}, ${ts}
      )
    `;

    // Log the handoff event on the studio side
    const eventId = randomUUID();
    await sql`
      INSERT INTO studio_event (
        id, studio_session_id, event_type, actor, payload_json, created_at
      ) VALUES (
        ${eventId},
        ${studioSessionId},
        'session_created',
        ${viewer.email},
        ${JSON.stringify({ source: "website_upgrade", upgradeSessionId: id })}::jsonb,
        ${ts}
      )
    `;

    // Mark upgrade session as transferred
    await updateSessionStatus(id, "transferred");
    await insertUpgradeEvent({
      sessionId: id,
      eventType: "handoff_to_maxwell",
      metadata: { studioSessionId },
    });

    return NextResponse.json(
      { studioSessionId, redirectTo: `/studio` },
      { status: 200 }
    );
  } catch (error) {
    log.error("upgrade.handoff", error);
    return NextResponse.json({ message: "Failed to transfer to Maxwell." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Handoff prompt builder
// ---------------------------------------------------------------------------

function buildHandoffPrompt(
  websiteUrl: string,
  overallScore: number,
  criticalIssues: string[],
  topRecommendations: string[],
  headline: string,
  subheadline: string,
  valueProposition: string,
  ctaText: string,
  keyChanges: string[],
  toneGuidance: string
): string {
  return `I want to rebuild my website. I've already run a full audit through Noon's Upgrade Your Website tool.

**Current website:** ${websiteUrl}
**Audit score:** ${overallScore}/10

**Critical issues found:**
${criticalIssues.map((i) => `- ${i}`).join("\n")}

**Top recommendations:**
${topRecommendations.map((r) => `- ${r}`).join("\n")}

**Upgraded copy direction already defined:**
- Headline: "${headline}"
- Subheadline: "${subheadline}"
- Value proposition: ${valueProposition}
- Primary CTA: "${ctaText}"

**Key changes to implement:**
${keyChanges.map((c) => `- ${c}`).join("\n")}

**Tone & voice:**
${toneGuidance}

Please help me build a new website that implements all these improvements.`;
}
