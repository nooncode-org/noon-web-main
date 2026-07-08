/**
 * lib/maxwell/reaper.ts
 *
 * F5-05 (auditoría master 2026-07, Ola E-2): reaper compartido para los
 * pipelines fire-and-forget de Web. Corre por cron (`/api/maxwell/reaper`,
 * vercel.json) y cierra los tres huecos sin retry server-side:
 *
 *   1. `studio_session` colgada en `generating_prototype` / `revision_*` —
 *      el único revert existente vive en el poll y depende de que el browser
 *      del cliente siga vivo.
 *   2. `website_upgrade_session` colgada en `crawling|analyzing|generating` —
 *      las rutas disparan el pipeline sin await; si el lambda muere, la fila
 *      queda intermedia para siempre. Se mueve a `error` (retryable por el
 *      cliente) + evento de auditoría.
 *   3. Outbox Web→App (`client_comment` / `client_request` / updates /
 *      attachments) con `forwarded_at IS NULL` — dead-letters permanentes si
 *      la App estaba caída al enviar. Se re-forwardean con los senders
 *      existentes; la App dedupe por external id (UNIQUE), así que el retry
 *      es idempotente.
 *
 * Además barre ventanas viejas del rate-limit distribuido (SEC-M5) y cablea
 * `archiveStaleUpgradeSessions` (existía sin caller).
 *
 * Todas las acciones son idempotentes y con batch acotado; cada fase aísla
 * sus errores para no tumbar a las demás. Umbrales >> peor caso legítimo
 * (poll budget ~3 min; maxDuration de upgrade 60s).
 */

import {
  listUnforwardedClientComments,
  listUnforwardedClientRequests,
  listUnforwardedClientRequestUpdates,
  listUnforwardedClientRequestAttachments,
  markClientCommentForwarded,
  markClientRequestForwarded,
  markClientRequestUpdateForwarded,
  markClientRequestAttachmentForwarded,
  revertStaleInFlightStudioSessions,
} from "@/lib/maxwell/repositories";
import {
  archiveStaleUpgradeSessions,
  failStaleInFlightUpgradeSessions,
  insertUpgradeEvent,
} from "@/lib/upgrade/repositories";
import type { UpgradeEventType, UpgradeSessionStatus } from "@/lib/upgrade/types";
import {
  extractNoonAppCommentId,
  isNoonAppProposalHandoffConfigured,
  sendClientCommentToNoonApp,
  sendClientRequestToNoonApp,
  sendClientRequestUpdateToNoonApp,
  sendClientRequestAttachmentToNoonApp,
} from "@/lib/noon-app-integration";
import { sweepRateLimitCounters } from "@/lib/server/rate-limit-distributed";
import { log } from "@/lib/server/logger";

/** Sesión in-flight sin actividad por más de esto = colgada. */
const STUCK_SESSION_MINUTES = 30;
/** Edad mínima de un dead-letter antes de re-forwardear (evita competir con el forward inline). */
const OUTBOX_MIN_AGE_MINUTES = 10;
/** Máximo de re-forwards por outbox por corrida (cada sender ya reintenta 3× internamente). */
const OUTBOX_BATCH = 20;

type OutboxCounts = { forwarded: number; failed: number };

export type ReaperReport = {
  studioSessionsReverted: number;
  upgradeSessionsFailed: number;
  upgradeSessionsArchived: number;
  outbox:
    | { skipped: "bridge_unconfigured" }
    | {
        comments: OutboxCounts;
        requests: OutboxCounts;
        updates: OutboxCounts;
        attachments: OutboxCounts;
      };
  rateLimitWindowsDeleted: number;
  errors: string[];
};

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const STUCK_UPGRADE_EVENT: Record<string, UpgradeEventType> = {
  crawling: "crawl_failed",
  analyzing: "audit_failed",
  generating: "generate_failed",
};

async function sweepOutbox<T>(
  label: string,
  rows: T[],
  forwardOne: (row: T) => Promise<void>,
  errors: string[],
): Promise<OutboxCounts> {
  const counts: OutboxCounts = { forwarded: 0, failed: 0 };
  for (const row of rows) {
    try {
      await forwardOne(row);
      counts.forwarded += 1;
    } catch (error) {
      // 4xx determinista o 5xx con retries agotados dentro del sender: la fila
      // sigue siendo dead-letter y la reintenta la próxima corrida.
      counts.failed += 1;
      log.warn("maxwell.reaper", `Outbox re-forward failed (${label})`, {
        error: error instanceof Error ? error.message : String(error),
      });
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return counts;
}

export async function runReaper(): Promise<ReaperReport> {
  const errors: string[] = [];
  const stuckCutoff = minutesAgoIso(STUCK_SESSION_MINUTES);
  const outboxCutoff = minutesAgoIso(OUTBOX_MIN_AGE_MINUTES);

  // 1. Studio sessions colgadas.
  let studioSessionsReverted = 0;
  try {
    const reverted = await revertStaleInFlightStudioSessions(stuckCutoff);
    studioSessionsReverted = reverted.length;
    if (reverted.length > 0) {
      log.info("maxwell.reaper", "Reverted stale in-flight studio sessions", {
        count: reverted.length,
        session_ids: reverted.map((r) => r.id),
      });
    }
  } catch (error) {
    errors.push(`studio: ${error instanceof Error ? error.message : String(error)}`);
    log.error("maxwell.reaper", error, { phase: "studio_sessions" });
  }

  // 2. Upgrade sessions colgadas → error (+ evento por sesión, best-effort).
  let upgradeSessionsFailed = 0;
  try {
    const failed = await failStaleInFlightUpgradeSessions(stuckCutoff);
    upgradeSessionsFailed = failed.length;
    for (const row of failed) {
      const eventType =
        STUCK_UPGRADE_EVENT[row.stuckStatus as UpgradeSessionStatus] ?? "generate_failed";
      try {
        await insertUpgradeEvent({
          sessionId: row.id,
          eventType,
          metadata: { reaped: true, stuck_status: row.stuckStatus },
        });
      } catch (eventError) {
        // El estado ya quedó en 'error' (lo que importa); el evento es forense.
        log.warn("maxwell.reaper", "Failed to record reap event", {
          session_id: row.id,
          error: eventError instanceof Error ? eventError.message : String(eventError),
        });
      }
    }
    if (failed.length > 0) {
      log.info("maxwell.reaper", "Failed stale in-flight upgrade sessions", {
        count: failed.length,
        session_ids: failed.map((r) => r.id),
      });
    }
  } catch (error) {
    errors.push(`upgrade: ${error instanceof Error ? error.message : String(error)}`);
    log.error("maxwell.reaper", error, { phase: "upgrade_sessions" });
  }

  // 3. Outbox Web→App. Orden: requests ANTES que updates/attachments (esos
  //    solo se barren con padre ya forwardeado).
  let outbox: ReaperReport["outbox"] = { skipped: "bridge_unconfigured" };
  if (isNoonAppProposalHandoffConfigured()) {
    const comments = await sweepOutbox(
      "comment",
      await listUnforwardedClientComments(outboxCutoff, OUTBOX_BATCH).catch(() => []),
      async (c) => {
        const response = await sendClientCommentToNoonApp({
          projectId: c.noonAppProjectId,
          externalCommentId: c.externalCommentId,
          body: c.body,
          at: c.createdAt,
        });
        const { commentId } = extractNoonAppCommentId(response);
        await markClientCommentForwarded(c.id, commentId);
      },
      errors,
    );

    const requests = await sweepOutbox(
      "request",
      await listUnforwardedClientRequests(outboxCutoff, OUTBOX_BATCH).catch(() => []),
      async (r) => {
        await sendClientRequestToNoonApp({
          projectId: r.noonAppProjectId,
          externalRequestId: r.externalRequestId,
          submittedBy: r.submittedBy,
          type: r.type,
          clientPriority: r.clientPriority,
          body: r.body,
          versionRef: r.versionRef,
          at: r.createdAt,
        });
        await markClientRequestForwarded(r.id);
      },
      errors,
    );

    const updates = await sweepOutbox(
      "request-update",
      await listUnforwardedClientRequestUpdates(outboxCutoff, OUTBOX_BATCH).catch(() => []),
      async (u) => {
        await sendClientRequestUpdateToNoonApp({
          externalRequestId: u.parentExternalRequestId,
          updateId: u.externalUpdateId,
          body: u.body,
          kind: "clarification",
          at: u.createdAt,
        });
        await markClientRequestUpdateForwarded(u.id);
      },
      errors,
    );

    const attachments = await sweepOutbox(
      "request-attachment",
      await listUnforwardedClientRequestAttachments(outboxCutoff, OUTBOX_BATCH).catch(() => []),
      async (a) => {
        await sendClientRequestAttachmentToNoonApp({
          externalRequestId: a.parentExternalRequestId,
          updateId: a.externalUpdateId,
          attachment: { id: a.id, filename: a.filename, mime: a.mime, size: a.sizeBytes },
          body: a.body,
          at: a.createdAt,
        });
        await markClientRequestAttachmentForwarded(a.id);
      },
      errors,
    );

    outbox = { comments, requests, updates, attachments };
  }

  // 4. Housekeeping: archivar upgrades inactivas (30d) + ventanas viejas del
  //    rate-limit distribuido (SEC-M5).
  let upgradeSessionsArchived = 0;
  try {
    upgradeSessionsArchived = await archiveStaleUpgradeSessions();
  } catch (error) {
    errors.push(`archive: ${error instanceof Error ? error.message : String(error)}`);
    log.error("maxwell.reaper", error, { phase: "archive" });
  }

  let rateLimitWindowsDeleted = 0;
  try {
    rateLimitWindowsDeleted = await sweepRateLimitCounters();
  } catch (error) {
    errors.push(`rate-limit: ${error instanceof Error ? error.message : String(error)}`);
    log.error("maxwell.reaper", error, { phase: "rate_limit_sweep" });
  }

  return {
    studioSessionsReverted,
    upgradeSessionsFailed,
    upgradeSessionsArchived,
    outbox,
    rateLimitWindowsDeleted,
    errors,
  };
}
