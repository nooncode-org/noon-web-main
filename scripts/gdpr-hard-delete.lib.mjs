/**
 * scripts/gdpr-hard-delete.lib.mjs
 *
 * B14 — Pure helpers for the GDPR Art. 17 hard-delete script.
 *
 * Split from the main `gdpr-hard-delete.mjs` so vitest can unit-test
 * the plan-building / Stripe-anonymisation / snapshot-serialisation
 * logic without a real Postgres. Same pattern as B45's
 * `check-migrations.lib.mjs`.
 *
 * Native Node imports only (no Next.js, no Supabase JS, no TypeScript).
 * Vitest imports this directly as .mjs.
 */

import { createHash } from "node:crypto";

/**
 * Hash an email to a stable 16-char hex digest. Mirrors `hashEmail()`
 * from `lib/server/logger.ts` (same algorithm, same truncation length)
 * so audit rows and log lines that mention the same email correlate.
 */
export function hashEmail(email) {
  return createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
}

/** Tables whose rows get hard-deleted via the studio_session CASCADE. */
export const CASCADE_DELETED_TABLES = [
  "studio_session",
  "studio_message",
  "studio_brief",
  "studio_version",
  "studio_event",
  "studio_message_feedback",
  "proposal_request",
  "client_workspace",
  "payment_event",
];

/** Tables deleted via email (no FK to studio_session). */
export const EMAIL_DELETED_TABLES = ["contact_leads"];

/**
 * Tables RETAINED for compliance audit (NOT touched by the cascade).
 * Documented here so future maintainers don't accidentally add them.
 */
export const RETAINED_TABLES = [
  "proposal_access_audit",
  "gdpr_deletion_log",
  "schema_migrations",
];

/**
 * Strip every non-essential column from payment_event rows. Used to
 * build the `preserved_payment_records` JSON column of gdpr_deletion_log.
 * Returns an array (not in-place).
 *
 * Crucially does NOT include: studio_session_id, payload_json,
 * created_by, reference, notes — anything that could leak PII back.
 */
export function anonymizeStripePayloads(rows) {
  return rows.map((r) => ({
    provider_payment_intent_id: r.provider_payment_intent_id ?? null,
    amount_usd:
      r.amount_usd == null
        ? null
        : typeof r.amount_usd === "string"
        ? Number.parseFloat(r.amount_usd)
        : r.amount_usd,
    currency: r.currency ?? null,
    paid_at:
      r.paid_at == null
        ? null
        : r.paid_at instanceof Date
        ? r.paid_at.toISOString()
        : r.paid_at,
    event_type: r.event_type,
  }));
}

/**
 * Build a deletion plan from SELECT-result inputs. Pure function —
 * does not touch DB. Caller is responsible for resolving
 * studioSessionIds, counts per table, and reading payment_event rows
 * before calling.
 */
export function buildDeletionPlan(inputs) {
  const generatedAt = inputs.generatedAt ?? new Date().toISOString();
  const emailHash = hashEmail(inputs.email);
  const stampSafe = generatedAt.replace(/[:.]/g, "-");

  return {
    emailHash,
    studioSessionIds: inputs.studioSessionIds,
    rowsByTable: inputs.rowsByTable,
    preservedPaymentRecords: anonymizeStripePayloads(inputs.paymentEvents),
    snapshotPath: `./gdpr-snapshots/${stampSafe}-${emailHash}.json`,
  };
}

/**
 * Serialise the full snapshot — pre-delete dump of every row about to
 * be deleted — to a JSON string for writing to `snapshotPath`. Wrapped
 * in a versioned envelope so future snapshot format changes can be
 * detected at restore time.
 */
export function serializeSnapshot(payload) {
  return JSON.stringify(
    {
      version: 1,
      generated_at: payload.generatedAt,
      email_hash: payload.emailHash,
      operator_name: payload.operatorName,
      studio_session_ids: payload.studioSessionIds,
      rows_by_table: payload.rowsByTable,
    },
    null,
    2,
  );
}

/**
 * Human-readable summary of a DeletionPlan for stdout display in the
 * dry-run / pre-exec stages of the script.
 */
export function formatPlanSummary(plan) {
  const lines = [];
  lines.push(`Email hash:            ${plan.emailHash}`);
  lines.push(`Studio sessions:       ${plan.studioSessionIds.length}`);
  if (plan.studioSessionIds.length > 0) {
    for (const id of plan.studioSessionIds) {
      lines.push(`  - ${id}`);
    }
  }
  lines.push("");
  lines.push("Rows to be DELETED via cascade:");
  const sortedTables = Object.keys(plan.rowsByTable).sort();
  for (const tbl of sortedTables) {
    lines.push(`  ${tbl.padEnd(28)} ${plan.rowsByTable[tbl]}`);
  }
  lines.push("");
  lines.push(`Payment records preserved into gdpr_deletion_log: ${plan.preservedPaymentRecords.length}`);
  for (const rec of plan.preservedPaymentRecords) {
    const id = rec.provider_payment_intent_id ?? "(no payment_intent_id)";
    const amt =
      rec.amount_usd != null
        ? `${rec.amount_usd.toFixed(2)} ${rec.currency ?? ""}`.trim()
        : "n/a";
    lines.push(`  - ${id}   ${amt}   (${rec.event_type})`);
  }
  lines.push("");
  lines.push(`Snapshot path: ${plan.snapshotPath}`);
  return lines.join("\n");
}
