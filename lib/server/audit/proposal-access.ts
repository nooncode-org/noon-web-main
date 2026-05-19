/**
 * lib/server/audit/proposal-access.ts
 *
 * B19 — Helpers for the proposal_access_audit table.
 *
 * Three responsibilities:
 *
 * 1. `hashClientIp(ip)` — produce a stable 16-char SHA-256 fingerprint
 *    of the client IP. Used so the audit table can correlate accesses
 *    from the same source without storing the raw IP (PII minimisation).
 *    Truncation to 16 hex chars keeps the index narrow and is collision-
 *    resistant at our expected volumes (thousands of accesses per
 *    proposal at most).
 *
 * 2. `truncateUserAgent(ua)` — normalise + cap UA strings at 200 chars
 *    after collapsing whitespace. UAs can be long (especially bot
 *    strings); 200 chars discriminate browser family + bot signatures.
 *
 * 3. `recordProposalAccessSafe(input)` — fire-and-forget wrapper around
 *    `insertProposalAccessAudit` that NEVER throws. Audit must never
 *    break the user flow; failures land in the structured logger as
 *    `audit.proposal-access.insert-failed` warnings.
 *
 * Pure helpers (no IO besides the optional insert) so they unit-test
 * cleanly.
 */

import { createHash } from "node:crypto";
import {
  insertProposalAccessAudit,
  type ProposalAccessAction,
} from "@/lib/maxwell/repositories";
import { log } from "@/lib/server/logger";

/**
 * SHA-256 of the IP, hex-encoded, truncated to 16 chars (≈64 bits of
 * collision space — enough for grouping at our scale, no PII recovery
 * possible without dictionary attack against a much smaller candidate
 * space than full IPv4/IPv6).
 *
 * Returns null for empty / "anonymous" inputs so the column stays NULL
 * instead of carrying a hash of a placeholder (which would
 * accidentally cluster all unknown-IP rows together).
 */
export function hashClientIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  if (!trimmed || trimmed === "anonymous") return null;
  return createHash("sha256").update(trimmed).digest("hex").slice(0, 16);
}

/** Cap at this many chars after whitespace collapse. */
const USER_AGENT_MAX_LENGTH = 200;

/**
 * Normalises and truncates a User-Agent string. Returns null for empty
 * inputs so the column stays NULL.
 */
export function truncateUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const compact = ua.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  return compact.length <= USER_AGENT_MAX_LENGTH
    ? compact
    : compact.slice(0, USER_AGENT_MAX_LENGTH);
}

/**
 * Fire-and-forget audit insert. NEVER throws. Use from RSCs / route
 * handlers without awaiting if you need pure best-effort, or `await`
 * if you want to ensure the row commits before the response returns.
 *
 * Both modes are safe — the catch swallows DB failures and logs them
 * via the structured logger so we keep visibility without breaking
 * the user flow.
 */
export async function recordProposalAccessSafe(input: {
  proposalToken: string;
  action: ProposalAccessAction;
  responseStatus: number;
  clientIp?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await insertProposalAccessAudit({
      proposalToken: input.proposalToken,
      action: input.action,
      responseStatus: input.responseStatus,
      clientIpHash: hashClientIp(input.clientIp),
      userAgentTruncated: truncateUserAgent(input.userAgent),
    });
  } catch (error) {
    log.warn(
      "audit.proposal-access.insert-failed",
      "Failed to record proposal_access_audit row",
      {
        proposal_token: input.proposalToken,
        action: input.action,
        response_status: input.responseStatus,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
}
