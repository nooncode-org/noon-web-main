/**
 * POST /api/upgrade/[id]/generate
 * Generate (or regenerate) the upgraded website version.
 * Can include an optional correction note for subsequent generations.
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { log } from "@/lib/server/logger";
import {
  getUpgradeSessionById,
  getAuditBySessionId,
  getPagesBySessionId,
  getNextVersionNumber,
  insertVersion,
  updateSessionStatus,
  insertUpgradeEvent,
  incrementCorrectionsUsed,
} from "@/lib/upgrade/repositories";
import { generateUpgradedVersion } from "@/lib/upgrade/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

const generateSchema = z.object({
  correctionNote: z.string().max(2000).optional(),
});

export async function POST(request: Request, { params }: Params) {
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

    const allowedStatuses = ["audit_ready", "version_ready", "error"];
    if (!allowedStatuses.includes(session.status)) {
      return NextResponse.json(
        { message: `Cannot generate from status '${session.status}'.` },
        { status: 422 }
      );
    }

    // Parse optional correction note
    let correctionNote: string | null = null;
    try {
      const body = await request.json();
      const parsed = generateSchema.parse(body);
      correctionNote = parsed.correctionNote ?? null;
    } catch {
      // no body is fine — first-time generation
    }

    const isCorrection = Boolean(correctionNote);

    // Enforce server-side correction limit (max 2 per session)
    if (isCorrection && session.correctionsUsed >= 2) {
      return NextResponse.json(
        { message: "Correction limit reached for this session." },
        { status: 422 }
      );
    }

    const audit = await getAuditBySessionId(id);
    if (!audit) {
      return NextResponse.json(
        { message: "Audit must be completed before generating an upgraded version." },
        { status: 422 }
      );
    }

    const pages = await getPagesBySessionId(id);

    // Mark as generating
    await updateSessionStatus(id, "generating");
    await insertUpgradeEvent({
      sessionId: id,
      eventType: "generate_started",
      metadata: { isCorrection },
    });

    // Run generation in same request (maxDuration=60s)
    runGeneratePipeline(id, session, audit, pages, correctionNote, isCorrection).catch(
      (err) => log.error("upgrade.generate.background", err)
    );

    return NextResponse.json({ status: "generating" }, { status: 202 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { message: "Invalid request.", fieldErrors: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    log.error("upgrade.generate", error);
    return NextResponse.json({ message: "Failed to start generation." }, { status: 500 });
  }
}

async function runGeneratePipeline(
  sessionId: string,
  session: NonNullable<Awaited<ReturnType<typeof getUpgradeSessionById>>>,
  audit: NonNullable<Awaited<ReturnType<typeof getAuditBySessionId>>>,
  pages: Awaited<ReturnType<typeof getPagesBySessionId>>,
  correctionNote: string | null,
  isCorrection: boolean
) {
  const result = await generateUpgradedVersion({
    pages,
    auditJson: audit.auditJson,
    questionsAnswers: session.questionsAnswers,
    contextNote: session.contextNote,
    correctionNote,
  });

  if (!result.ok) {
    await updateSessionStatus(sessionId, "error");
    await insertUpgradeEvent({
      sessionId,
      eventType: "generate_failed",
      metadata: { error: result.error },
    });
    return;
  }

  const versionNumber = await getNextVersionNumber(sessionId);
  await insertVersion({
    sessionId,
    versionNumber,
    versionJson: result.versionJson,
    summary: result.summary,
    isCorrection,
  });

  if (isCorrection) {
    await incrementCorrectionsUsed(sessionId);
    await insertUpgradeEvent({
      sessionId,
      eventType: "correction_applied",
      metadata: { versionNumber, note: correctionNote },
    });
  }

  await updateSessionStatus(sessionId, "version_ready");
  await insertUpgradeEvent({
    sessionId,
    eventType: "generate_completed",
    metadata: { versionNumber },
  });
}
