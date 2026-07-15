/**
 * lib/auth/verification-adapter.ts
 *
 * Minimal Auth.js v5 adapter for the email magic-link flow, on top of the
 * existing postgres.js client (`getDb()`). This repo has no users/accounts/
 * sessions tables — identity IS the email string — so we persist ONLY
 * verification tokens (table `auth_verification_token`, migration 033) and
 * keep users "virtual".
 *
 * Under `session.strategy: "jwt"` (auth.ts) @auth/core 0.41.0 asserts exactly
 * three adapter methods for an email provider: `createVerificationToken`,
 * `useVerificationToken`, `getUserByEmail`. We implement those plus the few
 * user/account methods the sign-in handshake calls, all as email-keyed no-ops,
 * and hard-throw the database-session methods (never reached under jwt).
 *
 * Google keeps working: `getUserByEmail` ALWAYS returns null, which is the
 * precondition that makes @auth/core's `OAuthAccountNotLinked` unreachable.
 *
 * Token security: @auth/core stores/looks up `sha256(rawToken + AUTH_SECRET)`
 * hex — the adapter receives the ALREADY-HASHED token. Do NOT hash again, and
 * do NOT filter by `expires` in SQL (core checks expiry itself to tell
 * "expired" from "missing").
 */

import type { Adapter, AdapterUser, VerificationToken } from "next-auth/adapters";
import { getDb } from "@/lib/server/db";

export function createVerificationTokenAdapter(): Adapter {
  return {
    // ── Verification tokens: the ONLY persisted state ───────────────────────
    async createVerificationToken(token: VerificationToken): Promise<VerificationToken> {
      const sql = getDb();
      await sql`
        INSERT INTO auth_verification_token (identifier, token, expires)
        VALUES (${token.identifier}, ${token.token}, ${token.expires.toISOString()})
      `;
      return token;
    },

    async useVerificationToken(params: {
      identifier: string;
      token: string;
    }): Promise<VerificationToken | null> {
      const sql = getDb();
      // Atomic delete-returning = single-use even under a race. No `expires`
      // filter: core compares expiry itself so it can distinguish expired
      // from never-existed.
      const rows = await sql<{ identifier: string; token: string; expires: Date }[]>`
        DELETE FROM auth_verification_token
        WHERE identifier = ${params.identifier} AND token = ${params.token}
        RETURNING identifier, token, expires
      `;
      const row = rows[0];
      if (!row) return null;
      return {
        identifier: row.identifier,
        token: row.token,
        expires: new Date(row.expires),
      };
    },

    // ── Virtual users: identity is the email, nothing is persisted ──────────
    async createUser(user: AdapterUser): Promise<AdapterUser> {
      // Discard core's random uuid — the app keys everything by email.
      return { ...user, id: user.email };
    },
    async getUser(): Promise<AdapterUser | null> {
      return null;
    },
    // ALWAYS null — this is what keeps the Google OAuth path safe
    // (OAuthAccountNotLinked becomes unreachable).
    async getUserByEmail(): Promise<AdapterUser | null> {
      return null;
    },
    async getUserByAccount(): Promise<AdapterUser | null> {
      return null;
    },
    async updateUser(user: Partial<AdapterUser> & { id: string }): Promise<AdapterUser> {
      // Unreachable while getUserByEmail is null, but echo defensively.
      return {
        id: user.id,
        email: user.email ?? user.id,
        emailVerified: user.emailVerified ?? null,
      };
    },
    async linkAccount() {
      // No-op: the Google path calls this once an adapter exists; we store
      // nothing (JWT session carries identity).
      return undefined;
    },

    // ── Database sessions unsupported under jwt strategy — loud stubs ────────
    async createSession(): Promise<never> {
      throw new Error("verification-adapter: database sessions unsupported (jwt strategy)");
    },
    async getSessionAndUser(): Promise<never> {
      throw new Error("verification-adapter: database sessions unsupported (jwt strategy)");
    },
    async updateSession(): Promise<never> {
      throw new Error("verification-adapter: database sessions unsupported (jwt strategy)");
    },
    async deleteSession(): Promise<never> {
      throw new Error("verification-adapter: database sessions unsupported (jwt strategy)");
    },
  };
}

/**
 * Reaper sweep — delete verification tokens whose expiry is comfortably past
 * (the flow's TTL is 15 min, so anything older than an hour is safe garbage).
 * Wired into lib/maxwell/reaper.ts. Import-safe without DATABASE_URL (getDb is
 * called lazily here).
 */
export async function sweepExpiredVerificationTokens(olderThanSeconds = 3600): Promise<number> {
  const sql = getDb();
  const cutoff = new Date(Date.now() - olderThanSeconds * 1000).toISOString();
  const rows = await sql<{ count: string }[]>`
    WITH deleted AS (
      DELETE FROM auth_verification_token
      WHERE expires < ${cutoff}
      RETURNING 1
    )
    SELECT count(*)::text AS count FROM deleted
  `;
  return Number(rows[0]?.count ?? 0);
}
