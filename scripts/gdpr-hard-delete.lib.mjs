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

/**
 * Tables whose rows get hard-deleted via the studio_session CASCADE chain.
 *
 * Direct FK → studio_session(id) ON DELETE CASCADE:
 *   studio_message, studio_brief, studio_version, studio_event,
 *   proposal_request, client_workspace, payment_event
 *
 * Transitive cascades (FK to the above tables, not to studio_session):
 *   studio_message_feedback → studio_message (CASCADE)
 *   proposal_review_event   → proposal_request (CASCADE)
 *   workspace_update        → client_workspace (CASCADE)
 *   client_comment          → client_workspace (CASCADE)            (v3 §9)
 *   client_request          → client_workspace (CASCADE)            (v3 §9)
 *   client_request_update   → client_request   (CASCADE)            (v3 §9 B.5a)
 *   client_request_attachment → client_request (CASCADE)            (v3 §9 B.5b)
 *
 * All deleted by a single DELETE FROM studio_session WHERE id IN (...).
 * NOTE: client_request_attachment's Storage BLOBS are NOT reachable by the SQL
 * cascade — they are deleted separately in gdpr-hard-delete.mjs.
 */
export const CASCADE_DELETED_TABLES = [
  "studio_session",
  "studio_message",
  "studio_brief",
  "studio_version",
  "studio_event",
  "studio_message_feedback",   // transitive via studio_message
  "proposal_request",
  "proposal_review_event",     // transitive via proposal_request
  "client_workspace",
  "workspace_update",          // transitive via client_workspace
  "client_comment",            // transitive via client_workspace (v3 §9)
  "client_request",            // transitive via client_workspace (v3 §9)
  "client_request_update",     // transitive via client_request (v3 §9 B.5a)
  "client_request_attachment", // transitive via client_request (v3 §9 B.5b)
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
    // `event_at` corresponds to payment_event.created_at (when the event row
    // was inserted into our DB — for Stripe webhooks this is moments after
    // Stripe processed the payment; for manual evidence it's when ops marked
    // the event). NOT to be confused with proposal_request.stripe_paid_at
    // which is a different field on a different table.
    event_at:
      r.event_at == null
        ? null
        : r.event_at instanceof Date
        ? r.event_at.toISOString()
        : r.event_at,
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
    const ts = rec.event_at ?? "(no event_at)";
    lines.push(`  - ${id}   ${amt}   ${rec.event_type}   @ ${ts}`);
  }
  lines.push("");
  lines.push(`Snapshot path: ${plan.snapshotPath}`);
  return lines.join("\n");
}

/**
 * Bucket holding B.5b client-request attachments (private). The SQL cascade
 * deletes the `client_request_attachment` rows, but the Storage objects are not
 * reachable by a cascade — they must be removed separately. See
 * gdpr-hard-delete.mjs (`deleteAttachmentBlobs`).
 */
export const ATTACHMENT_STORAGE_BUCKET = "client-request-attachments";

/**
 * Encode a Storage object key for a REST URL: percent-encode each path segment
 * but keep the slashes (the folder structure is significant). Mirrors
 * `encodeStorageKey` in lib/maxwell/attachment-storage.ts so the GDPR delete
 * targets the exact same object the upload created.
 */
export function encodeStorageObjectKey(key) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
