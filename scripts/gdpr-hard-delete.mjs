#!/usr/bin/env node
/**
 * scripts/gdpr-hard-delete.mjs
 *
 * B14 — GDPR Art. 17 hard-delete CLI. Operational tool for ops to
 * fulfil a "right to be forgotten" request from a client.
 *
 * STRATEGY (see docs/gdpr-runbook.md for the full operational flow):
 *
 *   1. The client's identity has been validated OUT OF BAND (email
 *      ownership challenge, support ticket signed, etc.). This script
 *      only consumes the verified email.
 *   2. Operator runs --dry-run FIRST. Plan is printed; one row is
 *      inserted into `gdpr_deletion_log` with status='dry_run' so the
 *      attempt is auditable even if no deletion happens.
 *   3. Operator copies the plan to the second approver via secure
 *      channel. Second approver reviews the plan, scope, and counts.
 *   4. Second approver names themselves with --second-approver "name"
 *      and the operator re-runs WITHOUT --dry-run. Pre-cascade snapshot
 *      is written to ./gdpr-snapshots/; the cascade runs inside a
 *      transaction; the log row updates to status='executed'.
 *   5. If anything goes wrong post-cascade, the snapshot file is the
 *      only path to manual restore (Supabase PITR window is the other,
 *      time-bounded).
 *
 * 2-PERSON APPROVAL is PROCEDURAL, not technically enforced. The script
 * trusts that --operator and --second-approver are honestly filled.
 * Enforcement lives in the runbook + the immutable audit row.
 *
 * USAGE:
 *
 *   # Dry-run (no DB writes other than the dry_run log row)
 *   node scripts/gdpr-hard-delete.mjs \
 *     --email client@example.com \
 *     --operator "alice@noon" \
 *     --dry-run
 *
 *   # Real exec (after second approver review)
 *   node scripts/gdpr-hard-delete.mjs \
 *     --email client@example.com \
 *     --operator "alice@noon" \
 *     --second-approver "bob@noon" \
 *     --confirm
 *
 * REQUIRES: DATABASE_URL (or POSTGRES_URL) in env. SSL required.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

import {
  ATTACHMENT_STORAGE_BUCKET,
  EMAIL_DELETED_TABLES,
  buildDeletionPlan,
  encodeStorageObjectKey,
  formatPlanSummary,
  hashEmail,
  serializeSnapshot,
} from "./gdpr-hard-delete.lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// ─── CLI parsing ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { dryRun: false, confirm: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case "--email":
        args.email = argv[++i];
        break;
      case "--operator":
        args.operator = argv[++i];
        break;
      case "--second-approver":
        args.secondApprover = argv[++i];
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--confirm":
        args.confirm = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`[gdpr] unknown flag: ${flag}`);
        printHelp();
        process.exit(1);
    }
  }
  return args;
}

function printHelp() {
  console.log(`scripts/gdpr-hard-delete.mjs — GDPR Art. 17 hard-delete CLI

Required:
  --email <addr>            Client email (verified out of band).
  --operator <name>         You. Goes into gdpr_deletion_log.operator_name.

Mode (pick one):
  --dry-run                 Print plan, write a dry_run log row, NO data changes.
  --confirm                 Execute the cascade. Requires --second-approver too.

Required only with --confirm:
  --second-approver <name>  Person who reviewed the dry-run plan. Goes into the log.

See docs/gdpr-runbook.md before running --confirm in production.
`);
}

function validateArgs(args) {
  const errors = [];
  if (!args.email) errors.push("--email is required");
  if (!args.operator) errors.push("--operator is required");
  if (!args.dryRun && !args.confirm) {
    errors.push("must pass either --dry-run or --confirm");
  }
  if (args.dryRun && args.confirm) {
    errors.push("cannot pass both --dry-run and --confirm");
  }
  if (args.confirm && !args.secondApprover) {
    errors.push("--confirm requires --second-approver per the 2-person workflow");
  }
  if (errors.length > 0) {
    for (const e of errors) console.error(`[gdpr] ${e}`);
    process.exit(1);
  }
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

function getDb() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error("[gdpr] DATABASE_URL (or POSTGRES_URL) is required.");
    process.exit(1);
  }
  return postgres(url, { ssl: "require", max: 1, connect_timeout: 10 });
}

async function resolveStudioSessionIds(sql, normalizedEmail) {
  const rows = await sql`
    SELECT id FROM studio_session
    WHERE lower(owner_email) = ${normalizedEmail}
  `;
  return rows.map((r) => r.id);
}

async function countRowsByTable(sql, sessionIds, normalizedEmail) {
  if (sessionIds.length === 0) {
    // Even with no sessions, contact_leads may have rows for this email.
    const cl = await sql`
      SELECT COUNT(*)::int AS c FROM contact_leads
      WHERE lower(email) = ${normalizedEmail}
    `;
    return { contact_leads: Number(cl[0]?.c ?? 0) };
  }

  const counts = {};

  // Tables with a direct FK to studio_session — straightforward IN query.
  const directFkTables = [
    "studio_message",
    "studio_brief",
    "studio_version",
    "studio_event",
    "proposal_request",
    "client_workspace",
    "payment_event",
  ];
  for (const tbl of directFkTables) {
    const rows = await sql`
      SELECT COUNT(*)::int AS c FROM ${sql(tbl)} WHERE studio_session_id IN ${sql(sessionIds)}
    `;
    counts[tbl] = Number(rows[0]?.c ?? 0);
  }

  // studio_session itself (counted by its own id).
  const ssRows = await sql`
    SELECT COUNT(*)::int AS c FROM studio_session WHERE id IN ${sql(sessionIds)}
  `;
  counts.studio_session = Number(ssRows[0]?.c ?? 0);

  // Transitive cascade #1: studio_message_feedback → studio_message → studio_session
  const smfRows = await sql`
    SELECT COUNT(*)::int AS c
    FROM studio_message_feedback smf
    WHERE smf.studio_message_id IN (
      SELECT id FROM studio_message WHERE studio_session_id IN ${sql(sessionIds)}
    )
  `;
  counts.studio_message_feedback = Number(smfRows[0]?.c ?? 0);

  // Transitive cascade #2: proposal_review_event → proposal_request → studio_session
  const preRows = await sql`
    SELECT COUNT(*)::int AS c
    FROM proposal_review_event pre
    WHERE pre.proposal_request_id IN (
      SELECT id FROM proposal_request WHERE studio_session_id IN ${sql(sessionIds)}
    )
  `;
  counts.proposal_review_event = Number(preRows[0]?.c ?? 0);

  // Transitive cascade #3: workspace_update → client_workspace → studio_session
  const wuRows = await sql`
    SELECT COUNT(*)::int AS c
    FROM workspace_update wu
    WHERE wu.client_workspace_id IN (
      SELECT id FROM client_workspace WHERE studio_session_id IN ${sql(sessionIds)}
    )
  `;
  counts.workspace_update = Number(wuRows[0]?.c ?? 0);

  // Transitive cascade #4: client_comment → client_workspace → studio_session (v3 §9)
  const ccRows = await sql`
    SELECT COUNT(*)::int AS c
    FROM client_comment
    WHERE client_workspace_id IN (
      SELECT id FROM client_workspace WHERE studio_session_id IN ${sql(sessionIds)}
    )
  `;
  counts.client_comment = Number(ccRows[0]?.c ?? 0);

  // Transitive cascade #5: client_request → client_workspace → studio_session (v3 §9)
  const crRows = await sql`
    SELECT COUNT(*)::int AS c
    FROM client_request
    WHERE client_workspace_id IN (
      SELECT id FROM client_workspace WHERE studio_session_id IN ${sql(sessionIds)}
    )
  `;
  counts.client_request = Number(crRows[0]?.c ?? 0);

  // Transitive cascade #6: client_request_update → client_request → … (v3 §9 B.5a)
  const cruRows = await sql`
    SELECT COUNT(*)::int AS c
    FROM client_request_update
    WHERE client_request_id IN (
      SELECT id FROM client_request WHERE client_workspace_id IN (
        SELECT id FROM client_workspace WHERE studio_session_id IN ${sql(sessionIds)}
      )
    )
  `;
  counts.client_request_update = Number(cruRows[0]?.c ?? 0);

  // Transitive cascade #7: client_request_attachment → client_request → … (v3 §9 B.5b)
  // (the row count == the number of Storage blobs to delete separately.)
  const craRows = await sql`
    SELECT COUNT(*)::int AS c
    FROM client_request_attachment
    WHERE client_request_id IN (
      SELECT id FROM client_request WHERE client_workspace_id IN (
        SELECT id FROM client_workspace WHERE studio_session_id IN ${sql(sessionIds)}
      )
    )
  `;
  counts.client_request_attachment = Number(craRows[0]?.c ?? 0);

  // Tables deleted by email (no FK to studio_session).
  for (const tbl of EMAIL_DELETED_TABLES) {
    const rows = await sql`
      SELECT COUNT(*)::int AS c FROM ${sql(tbl)} WHERE lower(email) = ${normalizedEmail}
    `;
    counts[tbl] = Number(rows[0]?.c ?? 0);
  }

  return counts;
}

async function readPaymentEvents(sql, sessionIds) {
  if (sessionIds.length === 0) return [];
  // payment_event has no `paid_at` column (that field lives on
  // proposal_request as stripe_paid_at, a different table). We alias
  // payment_event.created_at to event_at so the helper's expected shape
  // matches. See anonymizeStripePayloads doc for naming rationale.
  return await sql`
    SELECT event_type, provider_payment_intent_id, amount_usd, currency,
           created_at AS event_at
    FROM payment_event
    WHERE studio_session_id IN ${sql(sessionIds)}
  `;
}

async function readFullSnapshot(sql, sessionIds, normalizedEmail) {
  /** Selects EVERY row that will be touched, for the JSON dump. */
  const dump = {};
  if (sessionIds.length === 0) {
    dump.contact_leads = await sql`
      SELECT * FROM contact_leads WHERE lower(email) = ${normalizedEmail}
    `;
    return dump;
  }

  // Direct FK to studio_session
  const directFkTables = [
    "studio_message",
    "studio_brief",
    "studio_version",
    "studio_event",
    "proposal_request",
    "client_workspace",
    "payment_event",
  ];
  for (const tbl of directFkTables) {
    dump[tbl] = await sql`
      SELECT * FROM ${sql(tbl)} WHERE studio_session_id IN ${sql(sessionIds)}
    `;
  }

  // studio_session itself
  dump.studio_session = await sql`
    SELECT * FROM studio_session WHERE id IN ${sql(sessionIds)}
  `;

  // Transitive cascades (same join shape as countRowsByTable above).
  dump.studio_message_feedback = await sql`
    SELECT * FROM studio_message_feedback
    WHERE studio_message_id IN (
      SELECT id FROM studio_message WHERE studio_session_id IN ${sql(sessionIds)}
    )
  `;
  dump.proposal_review_event = await sql`
    SELECT * FROM proposal_review_event
    WHERE proposal_request_id IN (
      SELECT id FROM proposal_request WHERE studio_session_id IN ${sql(sessionIds)}
    )
  `;
  dump.workspace_update = await sql`
    SELECT * FROM workspace_update
    WHERE client_workspace_id IN (
      SELECT id FROM client_workspace WHERE studio_session_id IN ${sql(sessionIds)}
    )
  `;

  // v3 client-portal tables (§9). Cascade-deleted via client_workspace /
  // client_request; snapshotted here so the pre-delete dump is complete.
  dump.client_comment = await sql`
    SELECT * FROM client_comment
    WHERE client_workspace_id IN (
      SELECT id FROM client_workspace WHERE studio_session_id IN ${sql(sessionIds)}
    )
  `;
  dump.client_request = await sql`
    SELECT * FROM client_request
    WHERE client_workspace_id IN (
      SELECT id FROM client_workspace WHERE studio_session_id IN ${sql(sessionIds)}
    )
  `;
  dump.client_request_update = await sql`
    SELECT * FROM client_request_update
    WHERE client_request_id IN (
      SELECT id FROM client_request WHERE client_workspace_id IN (
        SELECT id FROM client_workspace WHERE studio_session_id IN ${sql(sessionIds)}
      )
    )
  `;
  // Includes blob_key — the only record of which Storage objects to remove.
  dump.client_request_attachment = await sql`
    SELECT * FROM client_request_attachment
    WHERE client_request_id IN (
      SELECT id FROM client_request WHERE client_workspace_id IN (
        SELECT id FROM client_workspace WHERE studio_session_id IN ${sql(sessionIds)}
      )
    )
  `;

  for (const tbl of EMAIL_DELETED_TABLES) {
    dump[tbl] = await sql`
      SELECT * FROM ${sql(tbl)} WHERE lower(email) = ${normalizedEmail}
    `;
  }
  return dump;
}

// ─── Storage (B.5b attachment blobs) ─────────────────────────────────────────

/** Read the blob keys of every attachment owned (transitively) by the email. */
async function readAttachmentBlobKeys(sql, sessionIds) {
  if (sessionIds.length === 0) return [];
  const rows = await sql`
    SELECT blob_key
    FROM client_request_attachment
    WHERE client_request_id IN (
      SELECT id FROM client_request WHERE client_workspace_id IN (
        SELECT id FROM client_workspace WHERE studio_session_id IN ${sql(sessionIds)}
      )
    )
  `;
  return rows.map((r) => r.blob_key);
}

/** Storage REST config (separate from DATABASE_URL — only needed for blobs). */
function readStorageConfig() {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) return null;
  return { baseUrl, serviceKey };
}

/**
 * Delete attachment blobs from the private Storage bucket. The DB rows are
 * already gone via the cascade; these objects are not reachable by SQL, so they
 * are removed here. A 404 means already-gone (treated as success). Returns
 * { deleted, failed: [{ key, status }] }.
 */
async function deleteAttachmentBlobs(blobKeys) {
  const cfg = readStorageConfig();
  if (!cfg) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are required to delete attachment blobs.",
    );
  }
  let deleted = 0;
  const failed = [];
  for (const key of blobKeys) {
    const res = await fetch(
      `${cfg.baseUrl}/storage/v1/object/${ATTACHMENT_STORAGE_BUCKET}/${encodeStorageObjectKey(key)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${cfg.serviceKey}` } },
    );
    if (res.ok || res.status === 404) deleted++;
    else failed.push({ key, status: res.status });
  }
  return { deleted, failed };
}

async function logAttempt(sql, payload) {
  // JSONB columns inserted as `JSON.stringify(...)::jsonb` per the repo
  // convention in lib/maxwell/repositories.ts (see studio_brief and
  // studio_event INSERTs). postgres.js does not have a generic
  // sql.json() helper; the explicit cast is the canonical pattern.
  const rows = await sql`
    INSERT INTO gdpr_deletion_log (
      email_hash, dry_run, status, operator_name, second_approver_name,
      studio_session_ids, rows_affected_by_table, preserved_payment_records,
      snapshot_path
    ) VALUES (
      ${payload.emailHash}, ${payload.dryRun}, ${payload.status},
      ${payload.operator}, ${payload.secondApprover ?? null},
      ${payload.studioSessionIds},
      ${JSON.stringify(payload.rowsByTable)}::jsonb,
      ${JSON.stringify(payload.preservedPaymentRecords)}::jsonb,
      ${payload.snapshotPath ?? null}
    )
    RETURNING id
  `;
  return rows[0]?.id;
}

async function markLogComplete(sql, logId, rowsByTable, errorMessage) {
  await sql`
    UPDATE gdpr_deletion_log
    SET status = ${errorMessage ? "failed" : "executed"},
        rows_affected_by_table = ${JSON.stringify(rowsByTable)}::jsonb,
        completed_at = now(),
        error_message = ${errorMessage ?? null}
    WHERE id = ${logId}
  `;
}

// ─── Cascade execution ───────────────────────────────────────────────────────

async function executeCascade(sql, sessionIds, normalizedEmail) {
  /** Single transaction. payment_event data is already preserved into
   *  gdpr_deletion_log; the cascade then drops the row along with all
   *  the studio_session children. contact_leads is deleted by email
   *  (no FK link). */
  const counts = {};
  await sql.begin(async (tx) => {
    if (sessionIds.length > 0) {
      // CASCADE handles studio_message, studio_brief, studio_version,
      // proposal_request, client_workspace, studio_event,
      // studio_message_feedback (transitively), and payment_event
      // when we delete studio_session. We count what got dropped
      // afterwards via system catalogs is unreliable here, so we
      // rely on the pre-count from the dry-run / plan.
      const deleted = await tx`
        DELETE FROM studio_session WHERE id IN ${tx(sessionIds)}
      `;
      counts.studio_session = deleted.count;
    } else {
      counts.studio_session = 0;
    }
    const clDel = await tx`
      DELETE FROM contact_leads WHERE lower(email) = ${normalizedEmail}
    `;
    counts.contact_leads = clDel.count;
  });
  return counts;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  validateArgs(args);

  const normalizedEmail = args.email.trim().toLowerCase();
  const emailHashShort = hashEmail(normalizedEmail);
  console.log(`[gdpr] email hash:  ${emailHashShort}`);
  console.log(`[gdpr] operator:    ${args.operator}`);
  if (args.secondApprover) {
    console.log(`[gdpr] approver:    ${args.secondApprover}`);
  }
  console.log(`[gdpr] mode:        ${args.dryRun ? "DRY-RUN" : "EXECUTE"}`);
  console.log("");

  const sql = getDb();
  let logId;
  let exitCode = 0;
  try {
    const sessionIds = await resolveStudioSessionIds(sql, normalizedEmail);
    const rowsByTable = await countRowsByTable(sql, sessionIds, normalizedEmail);
    const paymentEvents = await readPaymentEvents(sql, sessionIds);

    const plan = buildDeletionPlan({
      email: normalizedEmail,
      studioSessionIds: sessionIds,
      rowsByTable,
      paymentEvents,
    });

    console.log(formatPlanSummary(plan));
    console.log("");

    // B.5b: attachment blobs live in Storage, not the DB — surface them up front.
    const blobCount = rowsByTable.client_request_attachment ?? 0;
    if (blobCount > 0) {
      const storageReady = readStorageConfig() !== null;
      console.log(
        `[gdpr] ${blobCount} attachment blob(s) in Storage to delete on --confirm` +
          (storageReady
            ? "."
            : " — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are NOT set; set them before --confirm."),
      );
      console.log("");
    }

    // ── Dry-run path ─────────────────────────────────────────────────────
    if (args.dryRun) {
      logId = await logAttempt(sql, {
        emailHash: plan.emailHash,
        dryRun: true,
        status: "dry_run",
        operator: args.operator,
        secondApprover: args.secondApprover,
        studioSessionIds: plan.studioSessionIds,
        rowsByTable: plan.rowsByTable,
        preservedPaymentRecords: plan.preservedPaymentRecords,
        snapshotPath: null,
      });
      console.log(`[gdpr] dry-run logged as gdpr_deletion_log id=${logId}`);
      console.log("[gdpr] NO DATA WAS DELETED. To execute, re-run with --confirm + --second-approver.");
      return;
    }

    // ── Real-exec path ───────────────────────────────────────────────────
    // 0. Pre-flight: collect blob keys + require Storage env BEFORE any delete,
    //    so we never drop DB rows we then cannot fully scrub from Storage.
    const blobKeys = await readAttachmentBlobKeys(sql, sessionIds);
    if (blobKeys.length > 0 && readStorageConfig() === null) {
      throw new Error(
        `${blobKeys.length} attachment blob(s) to delete but SUPABASE_URL / ` +
          "SUPABASE_SERVICE_ROLE_KEY are not set. Set them and re-run.",
      );
    }

    // 1. Snapshot first.
    const snapshot = await readFullSnapshot(sql, sessionIds, normalizedEmail);
    const snapshotPath = resolve(REPO_ROOT, plan.snapshotPath);
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(
      snapshotPath,
      serializeSnapshot({
        emailHash: plan.emailHash,
        generatedAt: new Date().toISOString(),
        operatorName: args.operator,
        studioSessionIds: plan.studioSessionIds,
        rowsByTable: snapshot,
      }),
      "utf8",
    );
    console.log(`[gdpr] snapshot written: ${snapshotPath}`);

    // 2. Insert pending log row (preserved Stripe IDs captured BEFORE cascade).
    logId = await logAttempt(sql, {
      emailHash: plan.emailHash,
      dryRun: false,
      status: "pending_approval",
      operator: args.operator,
      secondApprover: args.secondApprover,
      studioSessionIds: plan.studioSessionIds,
      rowsByTable: plan.rowsByTable,
      preservedPaymentRecords: plan.preservedPaymentRecords,
      snapshotPath,
    });
    console.log(`[gdpr] log row created id=${logId}, executing cascade...`);

    // 3. Execute cascade.
    const realCounts = await executeCascade(sql, sessionIds, normalizedEmail);

    // 3b. Delete attachment blobs (DB rows are gone; Storage is not cascaded).
    if (blobKeys.length > 0) {
      const { deleted, failed } = await deleteAttachmentBlobs(blobKeys);
      realCounts.client_request_attachment_blobs = deleted;
      console.log(`[gdpr] Deleted ${deleted}/${blobKeys.length} attachment blob(s) from Storage`);
      if (failed.length > 0) {
        realCounts.client_request_attachment_blobs_failed = failed.length;
        console.error(
          `[gdpr] WARNING: ${failed.length} blob(s) failed to delete (manual cleanup needed):`,
        );
        for (const f of failed) console.error(`  - ${f.key} (HTTP ${f.status})`);
        exitCode = 1;
      }
    }

    // 4. Mark log complete.
    await markLogComplete(sql, logId, realCounts, null);
    console.log("");
    console.log(`[gdpr] DONE. Deleted ${realCounts.studio_session} studio_session row(s) (+ cascade)`);
    console.log(`[gdpr]      Deleted ${realCounts.contact_leads} contact_leads row(s)`);
    if (blobKeys.length > 0) {
      console.log(`[gdpr]      Deleted ${realCounts.client_request_attachment_blobs ?? 0} attachment blob(s)`);
    }
    console.log(`[gdpr] Log: gdpr_deletion_log id=${logId} (status=executed)`);
  } catch (err) {
    console.error(`[gdpr] FAILED: ${err.message}`);
    if (logId) {
      try {
        await markLogComplete(sql, logId, {}, err.message);
        console.error(`[gdpr] Log marked failed: gdpr_deletion_log id=${logId}`);
      } catch {
        // best effort, ignore.
      }
    }
    exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
  process.exit(exitCode);
}

main();
