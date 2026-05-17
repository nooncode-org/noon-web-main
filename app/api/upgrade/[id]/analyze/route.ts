/**
 * POST /api/upgrade/[id]/analyze
 * Continues to the AI analysis phase from crawl_done.
 * Called by the client after the user has answered all questions
 * (or skipped them) in answer_questions mode.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { log } from "@/lib/server/logger";
import {
  getUpgradeSessionById,
  getPagesBySessionId,
  upsertAudit,
  updateSessionStatus,
  insertUpgradeEvent,
} from "@/lib/upgrade/repositories";
import { analyzeWebsite } from "@/lib/upgrade/analyzer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

    if (session.status !== "crawl_done") {
      return NextResponse.json(
        { message: `Cannot analyze from status '${session.status}'.` },
        { status: 422 }
      );
    }

    await updateSessionStatus(id, "analyzing");
    await insertUpgradeEvent({ sessionId: id, eventType: "audit_started" });

    // Run analysis in background
    runAnalysis(id, session).catch((err) =>
      log.error("upgrade.analyze.background", err)
    );

    return NextResponse.json({ status: "analyzing" }, { status: 202 });
  } catch (error) {
    log.error("upgrade.analyze", error);
    return NextResponse.json({ message: "Failed to start analysis." }, { status: 500 });
  }
}

async function runAnalysis(
  sessionId: string,
  session: NonNullable<Awaited<ReturnType<typeof getUpgradeSessionById>>>
) {
  const pages = await getPagesBySessionId(sessionId);

  const auditResult = await analyzeWebsite({
    pages,
    questionsAnswers: session.questionsAnswers,
    contextNote: session.contextNote,
    mode: session.mode,
  });

  if (!auditResult.ok) {
    await updateSessionStatus(sessionId, "error");
    await insertUpgradeEvent({
      sessionId,
      eventType: "audit_failed",
      metadata: { error: auditResult.error },
    });
    return;
  }

  await upsertAudit({
    sessionId,
    auditJson: auditResult.auditJson,
    summary: auditResult.summary,
    pagesAnalyzed: pages.length,
  });

  await updateSessionStatus(sessionId, "audit_ready");
  await insertUpgradeEvent({
    sessionId,
    eventType: "audit_completed",
    metadata: { overallScore: auditResult.auditJson.overallScore },
  });
}
