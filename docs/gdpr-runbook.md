# GDPR Art. 17 — Hard Delete Runbook

> **Audience:** Noon ops staff fulfilling a "right to be forgotten" (GDPR Art. 17) request from a client.
>
> **Tool:** `scripts/gdpr-hard-delete.mjs` — CLI wrapper around a transactional cascade.
>
> **Audit ledger:** `public.gdpr_deletion_log` (migration `20260519_016_gdpr_deletion_log.sql`).
>
> **2-person workflow:** procedural, not technically enforced. The script logs both names; ops culture must ensure both are real and that the second person reviewed the dry-run plan before signing off.

---

## When this applies

Use this runbook **only** when:

1. The client has submitted a written deletion request (email, contact form, support ticket).
2. The client's identity has been verified — they own the email address being deleted.
3. The operator has consulted legal counsel (or applied the standing legal advice for routine GDPR deletions).
4. The deletion will be executed in **production Supabase** (`pdotsdahsrnnsoroxbfe`).

**DO NOT** use this script to clean test data, debug, or "tidy up". For test data cleanup, use the Supabase Dashboard SQL Editor with manual `DELETE` statements.

---

## What gets deleted

### Cascade DELETE (via `studio_session` ON DELETE CASCADE)

Every row from these tables tied to the client's `studio_session` rows:

**Direct FK → `studio_session` (CASCADE):**
- `studio_session` (root, deleted explicitly; cascades the rest)
- `studio_message`
- `studio_brief`
- `studio_version`
- `studio_event`
- `proposal_request`
- `client_workspace`
- `payment_event` — **identifiers preserved into `gdpr_deletion_log.preserved_payment_records` BEFORE the cascade.** Stripe Dashboard remains source of truth.

**Transitive cascades (FK to one of the above, not directly to `studio_session`):**
- `studio_message_feedback` (via `studio_message`)
- `proposal_review_event` (via `proposal_request`)
- `workspace_update` (via `client_workspace`)

### Delete by email

- `contact_leads` — deleted by `lower(email) = <normalized>`. No FK to `studio_session`.

### Retained for compliance

- `proposal_access_audit` (B19) — retained, references public token not email.
- `gdpr_deletion_log` itself — retained per GDPR Art. 30 ("records of processing").
- `schema_migrations` — operational metadata.

---

## Procedure (2-person, must be followed in order)

### Pre-flight

1. **Verify identity.** Email ownership challenge, support ticket history, etc. Document the verification step in the support thread before proceeding.
2. **Take a Supabase backup snapshot** via Supabase Dashboard → Database → Backups → "Create on-demand backup". Supabase PITR is the only recovery path within minutes if something goes wrong; the local snapshot file (`./gdpr-snapshots/...json`) is the operational fallback.
3. **Set environment variables locally:**
   ```bash
   export DATABASE_URL="postgres://...@pdotsdahsrnnsoroxbfe.supabase.co:5432/postgres"
   # (or POSTGRES_URL — the script accepts either)
   ```
   Use the service-role connection string from Vercel env (NOT a developer's PAT). The service role bypasses RLS, which the script needs to read across all the tables.

### Step 1 — Operator A: dry-run

Operator A (the one who received the deletion request) runs:

```bash
node scripts/gdpr-hard-delete.mjs \
  --email "client@example.com" \
  --operator "alice@noon" \
  --dry-run
```

The script:
- Resolves all `studio_session.id` rows for the email.
- Counts every row that would be deleted, per table.
- Reads `payment_event` rows and anonymises the identifier subset.
- Prints a human-readable plan to stdout.
- Inserts ONE row into `gdpr_deletion_log` with `status='dry_run'` and `dry_run=true`. **NO data is deleted.**

**Output Operator A captures:**
- Full stdout (paste into the support thread or share via secure channel)
- The `gdpr_deletion_log.id` printed at the end

### Step 2 — Operator B: review

Operator B (second approver, different person from Operator A) reviews:
- The plan output makes sense (session count not absurd, payment records present if client had a paid project, etc.).
- The email being deleted matches the verified request.
- The counts match expectations (e.g. if the client only had one session, the plan should not show 50).

Operator B replies in the secure channel: **"Approved for execution by <name>"** and provides their name to use in the `--second-approver` flag.

### Step 3 — Operator A: execute

Only after Step 2 sign-off:

```bash
node scripts/gdpr-hard-delete.mjs \
  --email "client@example.com" \
  --operator "alice@noon" \
  --second-approver "bob@noon" \
  --confirm
```

The script:
- Re-resolves session IDs (in case data changed since dry-run — re-display plan).
- Writes the full pre-delete dump to `./gdpr-snapshots/<timestamp>-<emailhash>.json`. **This file must be uploaded to the team's secure backup bucket within 24h** so it survives local machine loss.
- Inserts a `gdpr_deletion_log` row with `status='pending_approval'`, including `preserved_payment_records`.
- Executes the cascade DELETE inside a single transaction.
- Updates the log row to `status='executed'` with real `rows_affected_by_table` counts.
- Prints summary.

### Step 4 — Verify

In Supabase SQL Editor, confirm zero residual rows:

```sql
-- All should return 0:
SELECT COUNT(*) FROM studio_session WHERE lower(owner_email) = 'client@example.com';
SELECT COUNT(*) FROM contact_leads WHERE lower(email) = 'client@example.com';

-- Log row should show executed:
SELECT id, status, rows_affected_by_table, completed_at
FROM gdpr_deletion_log
WHERE email_hash = (SELECT encode(digest(lower('client@example.com'), 'sha256'), 'hex'))
ORDER BY started_at DESC LIMIT 5;
```

(Note: the SQL `digest()` is only available if `pgcrypto` extension is enabled. Otherwise compare via the script's own `hashEmail` output from earlier in the run.)

### Step 5 — Archive

1. Upload `./gdpr-snapshots/<file>.json` to the team's secure backup bucket.
2. Update the support thread: "Completed at <timestamp>, log id <uuid>, snapshot archived at <bucket path>".
3. Reply to the client confirming deletion (per GDPR Art. 12, response must be within 1 month of the request).

---

## Failure recovery

### Dry-run fails

Investigate the error. Common causes:
- `DATABASE_URL` is wrong / pointing at preview.
- Network issue.

No data risk. Re-run the dry-run after fixing.

### Execute fails mid-transaction

The cascade is wrapped in `sql.begin(...)`, so a failure inside the transaction ROLLBACKs everything. The `gdpr_deletion_log` row will be updated to `status='failed'` with `error_message` populated. NO data was actually deleted.

**Recovery:**
1. Look at `gdpr_deletion_log.error_message` for the cause.
2. Fix the root cause (DB connection lost, FK constraint we didn't know about, etc.).
3. Re-run from Step 1 (new dry-run).

### Execute succeeded but log update failed (rare)

If the transaction committed but the post-commit `markLogComplete` step failed, the log row will be stuck in `pending_approval`. Manually update via Supabase Dashboard SQL Editor:

```sql
UPDATE gdpr_deletion_log
SET status = 'executed', completed_at = now()
WHERE id = '<the_log_id>';
```

Verify data is actually gone via Step 4 queries.

### "I deleted the wrong client"

Within Supabase PITR window (24h on the Pro plan, NOT enabled on Free plan — verify before assuming):
1. Stop all writes to production (set Vercel into maintenance).
2. Open Supabase support ticket immediately: "Need PITR restore to <timestamp> for client deletion mistake".
3. Wait for support to confirm restore window options.

Outside PITR:
1. The `./gdpr-snapshots/<file>.json` is the only operational fallback. Run the **inverse** (manual reinsert via Supabase SQL Editor, table-by-table, respecting FK order).
2. If snapshot is also lost — the data is permanently gone. Notify legal counsel.

---

## What this runbook does NOT cover

- **Self-service deletion endpoint** — not built (ADR-008 FASE 1 = internal-only, no client portal yet). Deletion goes through this manual runbook only.
- **App-nooncode side** — this script only touches the Web Supabase. If the client also had data in App-side tables (leads, projects, etc. — only if they were ever sold to as outbound), trigger the App-side equivalent separately. Cross-coordinate with the App ops via the cross-repo daily sync.
- **Stripe-side data** — Stripe retains payment records per their own policies. Email Stripe support if the client also needs Stripe records anonymised.
- **Backup deletion** — backups (Supabase snapshots, Vercel deploy artifacts) are NOT touched by this script. If the client requires backup deletion, that's a separate ops process with the provider.

---

## Reference

- Script source: `scripts/gdpr-hard-delete.mjs`
- Pure helpers (and unit tests): `scripts/gdpr-hard-delete.lib.mjs` + `tests/scripts/gdpr-hard-delete.test.ts`
- Migration: `supabase/migrations/20260519_016_gdpr_deletion_log.sql`
- Roadmap context: `docs/handoff-fase2.md` §5.2 (B14 GDPR scope decision)
- ADR-008 (FASE 1 internal-only): `App-nooncode/docs/adrs/ADR-008-fase-0-commercial-and-scope.md`
