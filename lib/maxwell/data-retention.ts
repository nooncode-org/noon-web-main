/**
 * lib/maxwell/data-retention.ts
 *
 * Makes the portal's twelve-month promise true.
 *
 * When a membership ends the client is told, in their own language: "your
 * project, conversation and files stay saved for 12 months". Until now nothing
 * enforced the second half of that sentence — and nothing could, because the
 * website never recorded when a membership ended (migration 20260808_037 adds
 * that). This is the sweep that reads the clock.
 *
 * THREE THINGS STAND BETWEEN THIS FILE AND SOMEONE'S DATA, on purpose:
 *
 *   1. With DATA_RETENTION_MONTHS unset, `runDataRetentionSweep` returns
 *      `{ enabled: false }` having touched nothing. That is the shipped state.
 *   2. With it set, the sweep still only COUNTS AND NAMES what it would remove.
 *      Turning on a clock should not be the same gesture as starting to delete;
 *      you get to watch it for a month first.
 *   3. Only DATA_RETENTION_APPLY=1 deletes, and never more than MAX_PER_SWEEP
 *      projects in one run — a misconfigured cutoff should cost a bounded
 *      mistake, not the whole table.
 *
 * SCOPE: one DELETE against `studio_session`, whose ON DELETE CASCADE chain
 * removes the conversation, the workspace, versions, requests and attachment
 * rows (the chain is enumerated in scripts/gdpr-hard-delete.lib.mjs). It does
 * NOT touch the email-keyed tables that script also clears — contact leads and
 * the like. That is the difference between retiring a PROJECT and erasing a
 * PERSON, and only the person can ask for the second.
 */

import { getDb } from "@/lib/server/db";
import { log } from "@/lib/server/logger";

/** A single sweep never removes more than this, whatever the query returns. */
export const MAX_PER_SWEEP = 50;

/** What the portal promises today. Overridable, but this is the number in the copy. */
export const DEFAULT_RETENTION_MONTHS = 12;

export type RetentionCandidate = {
  studioSessionId: string;
  workspaceId: string;
  membershipEndedAt: string;
};

export type RetentionReport = {
  /** False when DATA_RETENTION_MONTHS is unset — the shipped default. */
  enabled: boolean;
  /** True only when DATA_RETENTION_APPLY=1; otherwise this was a dry run. */
  applied: boolean;
  months: number | null;
  /** Everything whose window has closed, capped at MAX_PER_SWEEP. */
  candidates: RetentionCandidate[];
  /** How many were actually deleted. Always 0 on a dry run. */
  deleted: number;
  /** Present when more candidates exist than one sweep will take. */
  remaining?: number;
};

/**
 * Months from `DATA_RETENTION_MONTHS`, or null when the feature is off.
 *
 * Anything unparseable, zero or negative reads as OFF rather than as a default.
 * A typo in an env var must not be the thing that starts deleting projects.
 */
export function readRetentionMonths(
  raw = process.env.DATA_RETENTION_MONTHS,
): number | null {
  if (!raw?.trim()) return null;
  const months = Number(raw.trim());
  if (!Number.isFinite(months) || !Number.isInteger(months) || months <= 0) {
    log.warn("maxwell.retention", "DATA_RETENTION_MONTHS is not a positive integer; sweep stays off.", {
      value: raw,
    });
    return null;
  }
  return months;
}

/** The instant before which a closed membership has run out its window. */
export function retentionCutoff(months: number, now: Date): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return cutoff;
}

/**
 * Projects whose window has closed.
 *
 * `membership_ended_at IS NOT NULL` is what makes this safe: a workspace only
 * has that set once the App reported the membership ended AND nobody has
 * reactivated since (reactivating clears it). An active client is not
 * selectable here by construction, not by a filter someone could drop.
 */
export async function findRetentionCandidates(
  cutoff: Date,
  limit = MAX_PER_SWEEP,
): Promise<{ candidates: RetentionCandidate[]; total: number }> {
  const sql = getDb();
  const rows = await sql<
    { studio_session_id: string; id: string; membership_ended_at: string | Date }[]
  >`
    SELECT studio_session_id, id, membership_ended_at
    FROM client_workspace
    WHERE membership_ended_at IS NOT NULL
      AND membership_ended_at < ${cutoff.toISOString()}
    ORDER BY membership_ended_at ASC
    LIMIT ${limit + 1}
  `;

  const total = rows.length;
  return {
    candidates: rows.slice(0, limit).map((r) => ({
      studioSessionId: r.studio_session_id,
      workspaceId: r.id,
      membershipEndedAt:
        r.membership_ended_at instanceof Date
          ? r.membership_ended_at.toISOString()
          : r.membership_ended_at,
    })),
    total,
  };
}

/**
 * Run the sweep. Reports by default; deletes only when told twice.
 *
 * `now` is injectable so the tests can age a row a year without waiting one.
 */
export async function runDataRetentionSweep(
  opts: { now?: Date } = {},
): Promise<RetentionReport> {
  const months = readRetentionMonths();
  if (months === null) {
    return { enabled: false, applied: false, months: null, candidates: [], deleted: 0 };
  }

  const now = opts.now ?? new Date();
  const cutoff = retentionCutoff(months, now);
  const { candidates, total } = await findRetentionCandidates(cutoff);
  const overflow = total > candidates.length ? { remaining: total - candidates.length } : {};

  const apply = process.env.DATA_RETENTION_APPLY === "1";
  if (!apply || candidates.length === 0) {
    log.info("maxwell.retention", "Retention sweep (dry run).", {
      months,
      cutoff: cutoff.toISOString(),
      candidates: candidates.length,
      ...overflow,
    });
    return { enabled: true, applied: false, months, candidates, deleted: 0, ...overflow };
  }

  const sql = getDb();
  const ids = candidates.map((c) => c.studioSessionId);
  // One statement; the FK cascade does the rest. Named ids only — never a
  // WHERE built from the same predicate that selected them, so what gets
  // deleted is exactly what was just reported.
  const deletedRows = await sql<{ id: string }[]>`
    DELETE FROM studio_session WHERE id IN ${sql(ids)} RETURNING id
  `;

  log.info("maxwell.retention", "Retention sweep deleted expired projects.", {
    months,
    cutoff: cutoff.toISOString(),
    deleted: deletedRows.length,
    ...overflow,
  });

  return {
    enabled: true,
    applied: true,
    months,
    candidates,
    deleted: deletedRows.length,
    ...overflow,
  };
}
