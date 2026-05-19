/**
 * POST /api/upgrade/[id]/audit
 * Starts the crawl → analyze pipeline for a session.
 * Runs asynchronously; client polls GET /api/upgrade/[id] for status updates.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { log } from "@/lib/server/logger";
import {
  getUpgradeSessionById,
  updateSessionStatus,
  insertUpgradePage,
  upsertAudit,
  insertUpgradeEvent,
} from "@/lib/upgrade/repositories";
import { crawlWebsite } from "@/lib/upgrade/crawler";
import { analyzeWebsite } from "@/lib/upgrade/analyzer";
import { normalizeUrl } from "@/lib/upgrade/url-normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Crawling + AI analysis can take up to 2 minutes
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

    // Guard: only start audit from pending or error
    if (!["pending", "error"].includes(session.status)) {
      return NextResponse.json(
        { message: `Cannot start audit from status '${session.status}'.` },
        { status: 422 }
      );
    }

    // Resolve the full URL to crawl
    const normalized = normalizeUrl(session.websiteUrlRaw);
    if (!normalized.ok) {
      return NextResponse.json({ message: normalized.error }, { status: 422 });
    }

    // Mark as crawling — respond immediately so the client can start polling
    await updateSessionStatus(id, "crawling");
    await insertUpgradeEvent({ sessionId: id, eventType: "crawl_started" });

    // Run crawl + analyze in the same request (maxDuration=120s)
    runAuditPipeline(id, normalized.full, session).catch((err) => {
      log.error("upgrade.audit.background", err);
    });

    return NextResponse.json({ status: "crawling" }, { status: 202 });
  } catch (error) {
    log.error("upgrade.audit", error);
    return NextResponse.json({ message: "Failed to start audit." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Pipeline (runs after response is sent)
// ---------------------------------------------------------------------------

async function runAuditPipeline(
  sessionId: string,
  fullUrl: string,
  session: Awaited<ReturnType<typeof getUpgradeSessionById>>
) {
  if (!session) return;

  // ── 1. Crawl ──────────────────────────────────────────────────────────────
  const crawlResult = await crawlWebsite(fullUrl);

  if (!crawlResult.ok && crawlResult.pages.length === 0) {
    await updateSessionStatus(sessionId, "error");
    await insertUpgradeEvent({
      sessionId,
      eventType: "crawl_failed",
      metadata: { error: crawlResult.error },
    });
    return;
  }

  // Persist crawled pages
  for (const page of crawlResult.pages) {
    await insertUpgradePage({
      sessionId,
      url: page.url,
      title: page.title,
      contentText: page.contentText,
      pageType: page.pageType,
      crawlOrder: page.crawlOrder,
      crawlDepth: page.crawlDepth,
    });
  }

  await insertUpgradeEvent({
    sessionId,
    eventType: "crawl_completed",
    metadata: { pagesFound: crawlResult.pages.length, partialCrawl: !crawlResult.ok },
  });

  // ── Pause for questions (mode = answer_questions) ─────────────────────────
  // The client will show questions one by one. Once all are answered, the
  // user calls POST /api/upgrade/[id]/analyze to continue.
  if (session.mode === "answer_questions") {
    await updateSessionStatus(sessionId, "crawl_done");
    return;
  }

  // ── 2. Analyze (best_judgment / specific_note) ────────────────────────────
  await updateSessionStatus(sessionId, "analyzing");
  await insertUpgradeEvent({ sessionId, eventType: "audit_started" });

  const auditResult = await analyzeWebsite({
    pages: crawlResult.pages,
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
    pagesAnalyzed: crawlResult.pages.length,
  });

  await updateSessionStatus(sessionId, "audit_ready");
  await insertUpgradeEvent({
    sessionId,
    eventType: "audit_completed",
    metadata: { overallScore: auditResult.auditJson.overallScore },
  });
}
