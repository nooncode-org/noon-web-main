# Database migrations

> **Source of truth:** `supabase/migrations/*.sql` in this repo.
> **Ledger:** `public.schema_migrations` table in each target database.
> **Drift check:** `scripts/check-migrations.mjs` (run automatically at `prebuild` when `CHECK_MIGRATIONS=1`).

## Why this exists (B45)

Before B45, "did we remember to apply that migration?" was answered by a runtime "column does not exist" error after deploy. With the `schema_migrations` ledger and the pre-build drift check, that failure mode shifts left to the build step.

## File naming convention

```
supabase/migrations/YYYYMMDD_NNN_short_description.sql
```

- `YYYYMMDD` — UTC date the migration was authored.
- `NNN` — three-digit zero-padded ordinal within that date.
- Filenames sort lexicographically into chronological order; the drift check relies on this.

## Workflow for a new migration

1. **Author the SQL file** under `supabase/migrations/` following the naming convention. Prefer additive, idempotent statements (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).

2. **Test locally** against a scratch DB:
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/20260516_013_schema_migrations.sql
   ```

3. **Apply to the target environment** (preview / production):
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/<filename>.sql
   ```

4. **Record it in the ledger** in the same transaction (or immediately after):
   ```sql
   INSERT INTO public.schema_migrations (filename, checksum, applied_by)
   VALUES (
     '<filename>.sql',
     '<sha256-of-file>',
     'manual:<operator-name>'
   );
   ```
   You can grab the sha256 with `node -e 'console.log(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex"))' supabase/migrations/<filename>.sql`.

5. **Push the SQL file** to git. The next deploy's pre-build check will pass.

## Drift check

### Manual run

```bash
CHECK_MIGRATIONS=1 DATABASE_URL=postgres://... npm run db:check-migrations
```

Possible outcomes:

- **OK** — `[check-migrations] OK — all N local migrations applied.` → exit 0.
- **DRIFT** — `[check-migrations] DRIFT — N migration(s) NOT yet applied:` → exit 1 (with `--strict`).
- **WARN orphans** — ledger references files no longer in git. Logged but does NOT fail the build (rolling back a migration is a legitimate, if rare, operation).

### Pre-build hook

`package.json` runs `node scripts/check-migrations.mjs --strict` as `prebuild`. The script is a no-op unless `CHECK_MIGRATIONS=1` is set in the env, so:

- **Local builds** (`npm run build`) — no-op (no env var). Safe to run offline.
- **Vercel preview / production builds** — enable by setting `CHECK_MIGRATIONS=1` and `DATABASE_URL` in the env vars panel. The build then fails fast if a SQL file is checked in without being applied.

## Bootstrap (one-time, done in B45)

Migration `20260516_013_schema_migrations.sql` creates the ledger and back-fills rows for the 14 pre-existing migrations with `checksum = NULL` and `applied_by = 'bootstrap:b45'`. The NULLs reflect that those files may have hand-drifted in prod before the ledger existed — we cannot reconstruct authoritative checksums. Going forward, every new row SHOULD record `checksum`.

## Caveats

- The check verifies **presence**, not **content**. A file that was edited after being applied will still pass (the checksum column captures the drift but the script does not currently compare). Future improvement: extend the script to flag checksum mismatches as warnings.
- The script connects with `ssl: "require"` and a 5s connect timeout, matching `scripts/manual/test-db.js`. Targets that don't accept SSL will fail.
- The ledger lives in `public.schema_migrations` — same schema as application tables. Backups should include it.
