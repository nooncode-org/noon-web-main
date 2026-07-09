/**
 * lib/upgrade/repositories.ts
 * Data access layer for the /upgrade module.
 * Uses postgres.js (same pattern as lib/maxwell/repositories.ts).
 */

import { getDb } from "@/lib/server/db";
import { randomUUID } from "crypto";
import type {
  UpgradeSession,
  UpgradeSessionStatus,
  UpgradeMode,
  QuestionAnswer,
  UpgradePage,
  PageType,
  UpgradeAudit,
  AuditJson,
  UpgradeVersion,
  VersionJson,
  UpgradeEventType,
  SessionWithDetails,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function createUpgradeSession(params: {
  ownerEmail: string;
  ownerName: string | null;
  websiteUrl: string;
  websiteUrlRaw: string;
  mode: UpgradeMode;
  contextNote?: string;
}): Promise<UpgradeSession> {
  const sql = getDb();
  const id = randomUUID();
  const ts = now();

  const rows = await sql<UpgradeSession[]>`
    INSERT INTO website_upgrade_session (
      id, owner_email, owner_name,
      website_url, website_url_raw,
      mode, context_note,
      status, corrections_used, source,
      created_at, updated_at, last_activity_at
    ) VALUES (
      ${id}, ${params.ownerEmail}, ${params.ownerName ?? null},
      ${params.websiteUrl}, ${params.websiteUrlRaw},
      ${params.mode}, ${params.contextNote ?? null},
      'pending', 0, 'website_upgrade',
      ${ts}, ${ts}, ${ts}
    )
    RETURNING
      id, owner_email AS "ownerEmail", owner_name AS "ownerName",
      website_url AS "websiteUrl", website_url_raw AS "websiteUrlRaw",
      mode, context_note AS "contextNote",
      questions_answers AS "questionsAnswers",
      status, corrections_used AS "correctionsUsed", source,
      created_at AS "createdAt", updated_at AS "updatedAt",
      last_activity_at AS "lastActivityAt", archived_at AS "archivedAt"
  `;

  return rows[0];
}

export async function getUpgradeSessionById(id: string): Promise<UpgradeSession | null> {
  const sql = getDb();
  const rows = await sql<UpgradeSession[]>`
    SELECT
      id, owner_email AS "ownerEmail", owner_name AS "ownerName",
      website_url AS "websiteUrl", website_url_raw AS "websiteUrlRaw",
      mode, context_note AS "contextNote",
      questions_answers AS "questionsAnswers",
      status, corrections_used AS "correctionsUsed", source,
      created_at AS "createdAt", updated_at AS "updatedAt",
      last_activity_at AS "lastActivityAt", archived_at AS "archivedAt"
    FROM website_upgrade_session
    WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

export async function findActiveSessionByUrl(
  ownerEmail: string,
  canonicalUrl: string
): Promise<UpgradeSession | null> {
  const sql = getDb();
  const rows = await sql<UpgradeSession[]>`
    SELECT
      id, owner_email AS "ownerEmail", owner_name AS "ownerName",
      website_url AS "websiteUrl", website_url_raw AS "websiteUrlRaw",
      mode, context_note AS "contextNote",
      questions_answers AS "questionsAnswers",
      status, corrections_used AS "correctionsUsed", source,
      created_at AS "createdAt", updated_at AS "updatedAt",
      last_activity_at AS "lastActivityAt", archived_at AS "archivedAt"
    FROM website_upgrade_session
    WHERE owner_email = ${ownerEmail}
      AND website_url = ${canonicalUrl}
      AND status     != 'archived'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listUserSessions(ownerEmail: string): Promise<UpgradeSession[]> {
  const sql = getDb();
  return sql<UpgradeSession[]>`
    SELECT
      id, owner_email AS "ownerEmail", owner_name AS "ownerName",
      website_url AS "websiteUrl", website_url_raw AS "websiteUrlRaw",
      mode, context_note AS "contextNote",
      questions_answers AS "questionsAnswers",
      status, corrections_used AS "correctionsUsed", source,
      created_at AS "createdAt", updated_at AS "updatedAt",
      last_activity_at AS "lastActivityAt", archived_at AS "archivedAt"
    FROM website_upgrade_session
    WHERE owner_email = ${ownerEmail}
    ORDER BY last_activity_at DESC
    LIMIT 20
  `;
}

export async function updateSessionStatus(
  id: string,
  status: UpgradeSessionStatus
): Promise<void> {
  const sql = getDb();
  const ts = now();
  await sql`
    UPDATE website_upgrade_session
    SET status = ${status}, updated_at = ${ts}, last_activity_at = ${ts}
    WHERE id = ${id}
  `;
}

export async function updateSessionStatusWithError(
  id: string,
  status: UpgradeSessionStatus
): Promise<void> {
  return updateSessionStatus(id, status);
}

export async function appendQuestionAnswer(
  id: string,
  qa: QuestionAnswer
): Promise<void> {
  const sql = getDb();
  const ts = now();
  await sql`
    UPDATE website_upgrade_session
    SET
      questions_answers = questions_answers || ${JSON.stringify([qa])}::jsonb,
      updated_at        = ${ts},
      last_activity_at  = ${ts}
    WHERE id = ${id}
  `;
}

export async function incrementCorrectionsUsed(id: string): Promise<void> {
  const sql = getDb();
  const ts = now();
  await sql`
    UPDATE website_upgrade_session
    SET corrections_used = corrections_used + 1, updated_at = ${ts}, last_activity_at = ${ts}
    WHERE id = ${id}
  `;
}

/**
 * F5-05 (auditoría 2026-07): las rutas de audit/analyze/generate fijan un
 * estado in-flight y disparan el pipeline sin await; si el lambda muere antes
 * del estado terminal, la fila queda colgada para siempre. El reaper la mueve
 * a `error`, desde donde el cliente puede reintentar (las rutas ya aceptan
 * re-POST desde `error`). El umbral del caller debe superar el maxDuration de
 * esas rutas (60s) con mucho margen.
 */
export async function failStaleInFlightUpgradeSessions(
  cutoffIso: string,
): Promise<{ id: string; stuckStatus: UpgradeSessionStatus }[]> {
  const sql = getDb();
  const ts = now();
  // CTE para devolver el estado EN QUE estaba colgada (RETURNING a secas vería
  // ya el 'error' nuevo); el caller lo usa para elegir el event type.
  return sql<{ id: string; stuckStatus: UpgradeSessionStatus }[]>`
    WITH stuck AS (
      SELECT id, status
      FROM website_upgrade_session
      WHERE status IN ('crawling', 'analyzing', 'generating')
        AND updated_at < ${cutoffIso}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE website_upgrade_session w
    SET status = 'error', updated_at = ${ts}, last_activity_at = ${ts}
    FROM stuck
    WHERE w.id = stuck.id
    RETURNING w.id, stuck.status AS "stuckStatus"
  `;
}

export async function archiveStaleUpgradeSessions(): Promise<number> {
  const sql = getDb();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ts = now();
  const rows = await sql<{ id: string }[]>`
    UPDATE website_upgrade_session
    SET status = 'archived', archived_at = ${ts}, updated_at = ${ts}
    WHERE status NOT IN ('archived', 'transferred', 'proposal_sent')
      AND last_activity_at < ${cutoff}
    RETURNING id
  `;
  return rows.length;
}

export async function getSessionWithDetails(id: string): Promise<SessionWithDetails | null> {
  const session = await getUpgradeSessionById(id);
  if (!session) return null;

  const [audit, latestVersion, pageCount] = await Promise.all([
    getAuditBySessionId(id),
    getLatestVersionBySessionId(id),
    getPageCount(id),
  ]);

  return { ...session, audit, latestVersion, pageCount };
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export async function insertUpgradePage(params: {
  sessionId: string;
  url: string;
  title: string | null;
  contentText: string | null;
  pageType: PageType;
  crawlOrder: number;
  crawlDepth: number;
}): Promise<UpgradePage> {
  const sql = getDb();
  const id = randomUUID();
  const ts = now();

  const rows = await sql<UpgradePage[]>`
    INSERT INTO website_upgrade_page (
      id, website_upgrade_session_id,
      url, title, content_text,
      page_type, crawl_order, crawl_depth,
      created_at
    ) VALUES (
      ${id}, ${params.sessionId},
      ${params.url}, ${params.title ?? null}, ${params.contentText ?? null},
      ${params.pageType}, ${params.crawlOrder}, ${params.crawlDepth},
      ${ts}
    )
    RETURNING
      id, website_upgrade_session_id AS "websiteUpgradeSessionId",
      url, title, content_text AS "contentText",
      page_type AS "pageType", crawl_order AS "crawlOrder",
      crawl_depth AS "crawlDepth", created_at AS "createdAt"
  `;
  return rows[0];
}

export async function getPagesBySessionId(sessionId: string): Promise<UpgradePage[]> {
  const sql = getDb();
  return sql<UpgradePage[]>`
    SELECT
      id, website_upgrade_session_id AS "websiteUpgradeSessionId",
      url, title, content_text AS "contentText",
      page_type AS "pageType", crawl_order AS "crawlOrder",
      crawl_depth AS "crawlDepth", created_at AS "createdAt"
    FROM website_upgrade_page
    WHERE website_upgrade_session_id = ${sessionId}
    ORDER BY crawl_order ASC
  `;
}

async function getPageCount(sessionId: string): Promise<number> {
  const sql = getDb();
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM website_upgrade_page
    WHERE website_upgrade_session_id = ${sessionId}
  `;
  return parseInt(rows[0]?.count ?? "0", 10);
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export async function upsertAudit(params: {
  sessionId: string;
  auditJson: AuditJson;
  summary: string;
  pagesAnalyzed: number;
}): Promise<UpgradeAudit> {
  const sql = getDb();
  const id = randomUUID();
  const ts = now();

  const rows = await sql<UpgradeAudit[]>`
    INSERT INTO website_upgrade_audit (
      id, website_upgrade_session_id,
      audit_json, summary, pages_analyzed,
      created_at, updated_at
    ) VALUES (
      ${id}, ${params.sessionId},
      ${JSON.stringify(params.auditJson)}::jsonb, ${params.summary}, ${params.pagesAnalyzed},
      ${ts}, ${ts}
    )
    ON CONFLICT (website_upgrade_session_id) DO UPDATE SET
      audit_json     = EXCLUDED.audit_json,
      summary        = EXCLUDED.summary,
      pages_analyzed = EXCLUDED.pages_analyzed,
      updated_at     = ${ts}
    RETURNING
      id, website_upgrade_session_id AS "websiteUpgradeSessionId",
      audit_json AS "auditJson", summary, pages_analyzed AS "pagesAnalyzed",
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return rows[0];
}

export async function getAuditBySessionId(sessionId: string): Promise<UpgradeAudit | null> {
  const sql = getDb();
  const rows = await sql<UpgradeAudit[]>`
    SELECT
      id, website_upgrade_session_id AS "websiteUpgradeSessionId",
      audit_json AS "auditJson", summary, pages_analyzed AS "pagesAnalyzed",
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM website_upgrade_audit
    WHERE website_upgrade_session_id = ${sessionId}
  `;
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

export async function insertVersion(params: {
  sessionId: string;
  versionNumber: number;
  versionJson: VersionJson;
  summary: string;
  isCorrection: boolean;
}): Promise<UpgradeVersion> {
  const sql = getDb();
  const id = randomUUID();
  const ts = now();

  const rows = await sql<UpgradeVersion[]>`
    INSERT INTO website_upgrade_version (
      id, website_upgrade_session_id,
      version_number, version_json, summary, is_correction,
      created_at
    ) VALUES (
      ${id}, ${params.sessionId},
      ${params.versionNumber}, ${JSON.stringify(params.versionJson)}::jsonb,
      ${params.summary}, ${params.isCorrection},
      ${ts}
    )
    RETURNING
      id, website_upgrade_session_id AS "websiteUpgradeSessionId",
      version_number AS "versionNumber", version_json AS "versionJson",
      summary, is_correction AS "isCorrection", created_at AS "createdAt"
  `;
  return rows[0];
}

export async function getLatestVersionBySessionId(
  sessionId: string
): Promise<UpgradeVersion | null> {
  const sql = getDb();
  const rows = await sql<UpgradeVersion[]>`
    SELECT
      id, website_upgrade_session_id AS "websiteUpgradeSessionId",
      version_number AS "versionNumber", version_json AS "versionJson",
      summary, is_correction AS "isCorrection", created_at AS "createdAt"
    FROM website_upgrade_version
    WHERE website_upgrade_session_id = ${sessionId}
    ORDER BY version_number DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getNextVersionNumber(sessionId: string): Promise<number> {
  const sql = getDb();
  const rows = await sql<{ max: string | null }[]>`
    SELECT MAX(version_number)::text AS max
    FROM website_upgrade_version
    WHERE website_upgrade_session_id = ${sessionId}
  `;
  return (parseInt(rows[0]?.max ?? "0", 10) || 0) + 1;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function insertUpgradeEvent(params: {
  sessionId: string;
  eventType: UpgradeEventType;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const sql = getDb();
  const id = randomUUID();
  const ts = now();

  await sql`
    INSERT INTO website_upgrade_event (
      id, website_upgrade_session_id,
      event_type, metadata, created_at
    ) VALUES (
      ${id}, ${params.sessionId},
      ${params.eventType},
      ${JSON.stringify(params.metadata ?? {})}::jsonb,
      ${ts}
    )
  `;
}
