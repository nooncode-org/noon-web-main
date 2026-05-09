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

async function userHasOtherSessionGeneratingWithoutVersions(
  ownerEmail: string,
  excludeSessionId: string,
): Promise<boolean> {
  const sql = getDb();
  const email = ownerEmail.trim().toLowerCase();
  const rows = await sql<{ ok: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM studio_session ss
      WHERE lower(ss.owner_email) = ${email}
        AND ss.id <> ${excludeSessionId}
        AND ss.deleted_at IS NULL
        AND ss.status = 'generating_prototype'
        AND NOT EXISTS (
          SELECT 1 FROM studio_version v WHERE v.studio_session_id = ss.id
        )
    ) AS ok
  `;
  return Boolean(rows[0]?.ok);
}

/**
 * Validates whether an initial v0 generation may start for this session and viewer.
 * Revisions (action update) are not checked here.
 */
export async function evaluateInitialPrototypeCreate(
  viewerEmail: string,
  sessionId: string,
): Promise<PrototypeCreateBlock | null> {
  if (await sessionHasAnyVersion(sessionId)) {
    return {
      code: "SESSION_ALREADY_HAS_PROTOTYPE",
      message:
        "This conversation already has a prototype. Use adjustments or start a new chat next month when your studio quota renews.",
    };
  }

  if (await userHasOtherSessionGeneratingWithoutVersions(viewerEmail, sessionId)) {
    return {
      code: "USER_CONCURRENT_PROTOTYPE_GENERATION",
      message:
        "Another conversation is already generating a prototype. Open that chat and wait for it to finish, or try again shortly.",
    };
  }

  const { startIso, endIso } = utcMonthRange();

  const globalCount = await countInitialPrototypesGloballyInRange(startIso, endIso);
  if (globalCount >= GLOBAL_MONTHLY_INITIAL_PROTOTYPES) {
    return {
      code: "GLOBAL_MONTHLY_PROTOTYPE_QUOTA",
      message:
        "Studio has reached its monthly prototype limit. New previews will be available at the start of next month. For urgent work, talk with a Noon agent.",
    };
  }

  const userSessionsWithV1 = await countDistinctSessionsWithV1ForUserInRange(
    viewerEmail,
    startIso,
    endIso,
  );
  if (userSessionsWithV1 >= USER_MONTHLY_INITIAL_LIMIT) {
    return {
      code: "USER_MONTHLY_PROTOTYPE_QUOTA",
      message:
        "You have already used your monthly studio prototype (one interactive preview with its adjustments on our side). To explore another product direction this month, talk with a Noon agent.",
    };
  }

  return null;
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
