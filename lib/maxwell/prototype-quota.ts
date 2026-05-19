/**
 * Monthly limits for initial (v1) Maxwell Studio prototypes:
 * - Per user: one session may reach a first completed prototype per UTC calendar month.
 * - Global: cap on first completed prototypes across all users per UTC month.
 */

import { getDb } from "@/lib/server/db";

export const GLOBAL_MONTHLY_INITIAL_PROTOTYPES = 15;

/** Distinct studio sessions per account that may complete a first (v1) prototype per UTC month. */
export const USER_MONTHLY_INITIAL_LIMIT = 1;

export type PrototypeCreateBlockCode =
  | "USER_MONTHLY_PROTOTYPE_QUOTA"
  | "GLOBAL_MONTHLY_PROTOTYPE_QUOTA"
  | "USER_CONCURRENT_PROTOTYPE_GENERATION"
  | "SESSION_ALREADY_HAS_PROTOTYPE";

export type PrototypeCreateBlock = {
  code: PrototypeCreateBlockCode;
  message: string;
};

export function utcMonthRange(reference = new Date()): { startIso: string; endIso: string } {
  const y = reference.getUTCFullYear();
  const m = reference.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

async function countInitialPrototypesGloballyInRange(
  startIso: string,
  endIso: string,
): Promise<number> {
  const sql = getDb();
  const rows = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c
    FROM studio_version sv
    WHERE sv.version_number = 1
      AND sv.created_at >= ${startIso}::timestamptz
      AND sv.created_at < ${endIso}::timestamptz
  `;
  return Number(rows[0]?.c ?? 0);
}

async function countDistinctSessionsWithV1ForUserInRange(
  ownerEmail: string,
  startIso: string,
  endIso: string,
): Promise<number> {
  const sql = getDb();
  const email = ownerEmail.trim().toLowerCase();
  const rows = await sql<{ c: string }[]>`
    SELECT COUNT(DISTINCT sv.studio_session_id)::text AS c
    FROM studio_version sv
    INNER JOIN studio_session ss ON ss.id = sv.studio_session_id
    WHERE sv.version_number = 1
      AND sv.created_at >= ${startIso}::timestamptz
      AND sv.created_at < ${endIso}::timestamptz
      AND lower(ss.owner_email) = ${email}
  `;
  return Number(rows[0]?.c ?? 0);
}

async function sessionHasAnyVersion(sessionId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql<{ ok: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM studio_version v WHERE v.studio_session_id = ${sessionId}
    ) AS ok
  `;
  return Boolean(rows[0]?.ok);
}

// `userHasOtherSessionGeneratingWithoutVersions` was inlined into
// `evaluateInitialPrototypeCreate` below (B11) — the check now runs
// inside a transaction-scoped advisory lock, so the standalone helper
// that read outside any lock was removed to avoid future callers
// re-introducing the race.

/**
 * Validates whether an initial v0 generation may start for this session and viewer.
 * Revisions (action update) are not checked here.
 *
 * B11 — Race condition fix (2026-05-18):
 *
 *   Before: the 4 checks ran sequentially with no lock. Two concurrent
 *   POSTs from the same user could each pass `USER_MONTHLY_PROTOTYPE_QUOTA`
 *   and `USER_CONCURRENT_PROTOTYPE_GENERATION` before either had time to
 *   create the v1 row, both proceeded to v0, and the user ended up with
 *   two parallel prototypes — silently bypassing the per-user monthly cap.
 *
 *   After: all 4 checks run inside a single transaction guarded by an
 *   advisory lock on `hashtext(viewerEmail)`. Same pattern as the other
 *   3 advisory-lock sites in `lib/maxwell/repositories.ts` (lines 897,
 *   962, 1393 — workspace creation, version creation, prototype handoff).
 *   The lock auto-releases at COMMIT, so it only serialises the brief
 *   check window, not the v0 generation itself.
 *
 * Residual race surface (intentionally NOT fixed by this lock alone):
 *
 *   The lock only covers the check window. Between this function
 *   returning `null` (allowed) and `studio_version` row creation by the
 *   poll endpoint, there is a generation window of 30-90s. A user who
 *   spams "generate" twice within that window will still see both
 *   requests pass the check. Mitigating that fully would require an
 *   intent-marker row with TTL — out of scope for B11 minimal. The
 *   existing UI-side state (`isGenerating` boolean in studio-shell)
 *   prevents single-tab spam; cross-tab is the residual.
 *
 * Lock key choice: `viewerEmail` (lowercased + trimmed) is the natural
 * key because the per-user monthly limit is the constraint we're
 * protecting. Per-session would not protect that limit; per-something-
 * smaller would be ineffective.
 */
export async function evaluateInitialPrototypeCreate(
  viewerEmail: string,
  sessionId: string,
): Promise<PrototypeCreateBlock | null> {
  const sql = getDb();
  const normalizedEmail = viewerEmail.trim().toLowerCase();
  const { startIso, endIso } = utcMonthRange();

  // B11 — Single transaction with advisory lock on the viewer's email.
  // All 4 read queries run inside the lock so two concurrent calls from
  // the same user serialise instead of racing past the quota check.
  return await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${normalizedEmail}))`;

    // Check 1: this session already produced a version (most specific, cheapest).
    const sessionHasVersionRows = await tx<{ ok: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM studio_version v WHERE v.studio_session_id = ${sessionId}
      ) AS ok
    `;
    if (sessionHasVersionRows[0]?.ok) {
      return {
        code: "SESSION_ALREADY_HAS_PROTOTYPE" as const,
        message:
          "This conversation already has a prototype. Use adjustments or start a new chat next month when your studio quota renews.",
      };
    }

    // Check 2: another of this user's sessions is mid-generation (no version row yet).
    const concurrentRows = await tx<{ ok: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM studio_session ss
        WHERE lower(ss.owner_email) = ${normalizedEmail}
          AND ss.id <> ${sessionId}
          AND ss.deleted_at IS NULL
          AND ss.status = 'generating_prototype'
          AND NOT EXISTS (
            SELECT 1 FROM studio_version v WHERE v.studio_session_id = ss.id
          )
      ) AS ok
    `;
    if (concurrentRows[0]?.ok) {
      return {
        code: "USER_CONCURRENT_PROTOTYPE_GENERATION" as const,
        message:
          "Another conversation is already generating a prototype. Open that chat and wait for it to finish, or try again shortly.",
      };
    }

    // Check 3: global monthly cap.
    const globalRows = await tx<{ c: string }[]>`
      SELECT COUNT(*)::text AS c
      FROM studio_version sv
      WHERE sv.version_number = 1
        AND sv.created_at >= ${startIso}::timestamptz
        AND sv.created_at < ${endIso}::timestamptz
    `;
    if (Number(globalRows[0]?.c ?? 0) >= GLOBAL_MONTHLY_INITIAL_PROTOTYPES) {
      return {
        code: "GLOBAL_MONTHLY_PROTOTYPE_QUOTA" as const,
        message:
          "Studio has reached its monthly prototype limit. New previews will be available at the start of next month. For urgent work, talk with a Noon agent.",
      };
    }

    // Check 4: per-user monthly cap.
    const userRows = await tx<{ c: string }[]>`
      SELECT COUNT(DISTINCT sv.studio_session_id)::text AS c
      FROM studio_version sv
      INNER JOIN studio_session ss ON ss.id = sv.studio_session_id
      WHERE sv.version_number = 1
        AND sv.created_at >= ${startIso}::timestamptz
        AND sv.created_at < ${endIso}::timestamptz
        AND lower(ss.owner_email) = ${normalizedEmail}
    `;
    if (Number(userRows[0]?.c ?? 0) >= USER_MONTHLY_INITIAL_LIMIT) {
      return {
        code: "USER_MONTHLY_PROTOTYPE_QUOTA" as const,
        message:
          "You have already used your monthly studio prototype (one interactive preview with its adjustments on our side). To explore another product direction this month, talk with a Noon agent.",
      };
    }

    return null;
  });
}

export type PrototypeQuotaSnapshot = {
  /** Distinct sessions with a v1 row created this UTC month for this account. */
  userDistinctSessionsWithV1ThisUtcMonth: number;
  userMonthlyInitialLimit: number;
  globalInitialPrototypesThisUtcMonth: number;
  globalMonthlyInitialLimit: number;
  /** Whether this session already has any `studio_version` row (only when `sessionId` was provided). */
  currentSessionHasAnyVersion: boolean | null;
};

/**
 * Read-only counts for Maxwell Studio UI (same rules as {@link evaluateInitialPrototypeCreate}).
 */
export async function getPrototypeQuotaSnapshot(
  viewerEmail: string,
  sessionId?: string | null,
): Promise<PrototypeQuotaSnapshot> {
  const { startIso, endIso } = utcMonthRange();
  const email = viewerEmail.trim().toLowerCase();

  const [globalInitialPrototypesThisUtcMonth, userDistinctSessionsWithV1ThisUtcMonth, currentSessionHasAnyVersion] =
    await Promise.all([
      countInitialPrototypesGloballyInRange(startIso, endIso),
      countDistinctSessionsWithV1ForUserInRange(email, startIso, endIso),
      sessionId ? sessionHasAnyVersion(sessionId) : Promise.resolve(null),
    ]);

  return {
    userDistinctSessionsWithV1ThisUtcMonth,
    userMonthlyInitialLimit: USER_MONTHLY_INITIAL_LIMIT,
    globalInitialPrototypesThisUtcMonth,
    globalMonthlyInitialLimit: GLOBAL_MONTHLY_INITIAL_PROTOTYPES,
    currentSessionHasAnyVersion,
  };
}
