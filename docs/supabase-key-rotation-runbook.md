# Supabase key rotation runbook

> **✅ EXECUTED 2026-07-06** — DB password reset + JWT secret rotated
> (anon + service_role) + Vercel envs updated + redeploy + smokes green.
> The leaked credentials are dead. This runbook stays as the procedure
> for any future rotation.
>
> Execution note for next time: the generated DB password contained a
> character that broke `decodeURIComponent` in postgres.js
> (`URIError: URI malformed` at build). Use an ALPHANUMERIC-ONLY
> password (32+ chars) to avoid the URL-encoding class entirely.

**Deadline:** 2026-07-22 (hard — earlier credentials were exposed in
a since-redacted history; ops postponed rotation to this date when the
issue was first triaged).

**Last updated:** 2026-07-06 (pre-rotation review — SEC-H4, auditoría 2026-07: scope
corrected; `SUPABASE_SERVICE_ROLE_KEY` is now IN scope — see Step 1 warning)

**Owners:** repo owner + ops (rotation is procedural, not automated).

---

## Why this runbook exists

The Supabase service-role-equivalent credentials currently in
production were exposed at some earlier point in repo history (now
redacted from working tree, but the historical commit objects are
unavoidable). Rotating credentials is the only safe remediation.

The rotation was deliberately scheduled for 2026-07-22 to:

1. Give the FASE 2 hardening enough time to settle (no rotation
   during code-velocity periods).
2. Coincide with the planned NOON_APP_WEBHOOK_SECRET legacy-name
   cleanup (cross-repo; see `docs/handoff-fase2.md` section on
   pending cross-repo items).

This document is the deterministic checklist for that day. Run it
top-to-bottom; do not skip steps.

---

## Scope of credentials to rotate

| Env variable | Where it lives in code | Surface |
|---|---|---|
| `DATABASE_URL` | `lib/server/db.ts` (postgres.js client) | Server-side reads/writes. Most-used. |
| `POSTGRES_URL` | Same — fallback alias used by Supabase's own pooler URL convention | Server-side. Same credential as DATABASE_URL in our setup. |
| `SUPABASE_URL` | `lib/maxwell/attachment-storage.ts`, `scripts/gdpr-hard-delete.mjs`, `scripts/manual/test-rest.js` | REST + Storage surface. |
| `SUPABASE_ANON_KEY` | `scripts/manual/test-rest.js` | Public-by-design key. Rotating is still good hygiene because the URL itself is gated by it. |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/maxwell/attachment-storage.ts` (v3 attachments — PROD path), `scripts/gdpr-hard-delete.mjs` | **Added to scope 2026-07-06.** The 2026-05-19 revision said "we do not use the service role key" — stale since the v3 attachments slice. If this key is not updated in Vercel after rotation, attachment upload/read and GDPR blob deletion break. |

**NOT in scope (separate rotation):** OpenAI, V0, Resend, Stripe,
Sentry. These have their own rotation cadence + are not affected by
the Supabase issue.

---

## Pre-rotation checks (do these BEFORE the rotation day)

```bash
# 1. Working tree clean, on main, in sync
git status                                # "working tree clean"
git log -1 --oneline                      # confirm you're at expected HEAD

# 2. All gates green at HEAD — establish a known-good baseline so
#    you can tell "post-rotation breakage" from "pre-existing flake"
npx tsc --noEmit
npm test                                  # baseline tests pass
npm run build

# 3. Smoke test the current DB connection from your local laptop
node scripts/check-migrations.mjs --strict
# Expected: prints "Migration check passed" without errors

# 4. Note the current HEAD SHA + test count for the post-rotation
#    sanity check. Write them down:
#      HEAD: ______________
#      Tests: ___________ passing
```

If any of those fail, fix BEFORE starting rotation. Rotating during
a degraded state hides which failures are rotation-caused.

---

## Rotation procedure

> Estimated time: 20–40 minutes including verification.
>
> Two-person check recommended: have a teammate read the env vars
> back to you after you paste them in. A typo here causes a hard
> outage.

### Step 1 — Rotate at Supabase

1. Log into the Supabase dashboard for the noon-web project.
2. **Project Settings → Database → Connection string**.
3. Click "Reset database password". Confirm.
4. **Copy the new connection string immediately** — the dashboard
   only shows it once. If you lose it, you need to reset again.
5. Note the new password expiry policy if Supabase displays one.
6. **Project Settings → API → Project API Keys**.
7. Click "Generate new" next to `anon` public key. Confirm.
8. **Copy the new `anon` key immediately** — same one-shot
   visibility.
9. **Service role key — DO NOT skip (corrected 2026-07-06).** The
   codebase now uses `SUPABASE_SERVICE_ROLE_KEY` (v3 attachments +
   GDPR blob deletion). Two cases depending on what the dashboard
   shows:
   - **Legacy JWT keys** (`anon` / `service_role` shown as long JWTs
     under "Project API Keys"): regenerating them resets the project
     **JWT secret**, which invalidates BOTH keys at once — you cannot
     rotate `anon` and "leave service role alone". Copy BOTH new keys.
   - **New API keys** (`sb_publishable_...` / `sb_secret_...`): they
     rotate independently — rotate both anyway (same leak window).
   Either way: **copy the new service-role/secret key** and update it
   in Vercel in Step 2.

### Step 2 — Update Vercel env vars

Vercel dashboard → noon-web project → Settings → Environment
Variables. For EACH env name below:

- Find the entry. Click edit.
- Paste the new value. Confirm scope (Production + Preview both, NOT
  Development).
- Save.

Update in this order to minimise the inconsistent-state window:

1. `DATABASE_URL`
2. `POSTGRES_URL` (same value as DATABASE_URL)
3. `SUPABASE_URL` (only if it changed — usually only the password,
   not the URL host, but verify)
4. `SUPABASE_ANON_KEY`
5. `SUPABASE_SERVICE_ROLE_KEY` (added 2026-07-06 — attachments + GDPR
   break if stale)

Gotcha (verified 2026-06): set values via the **Dashboard UI**, not
`vercel env add` with piped stdin — piped stdin can store an empty
string, and Sensitive vars read back empty.

### Step 3 — Force a redeploy

Vercel does NOT pick up env changes on already-running serverless
functions until the next invocation rebuild. Force it:

1. Vercel dashboard → noon-web → Deployments.
2. Find the latest Production deployment.
3. "Redeploy" button → confirm. Choose "Use existing build cache"
   for speed (env vars are injected per-invocation, not baked in).
4. Watch the deploy log; confirm "Ready" within ~2 minutes.

### Step 4 — Smoke test production

```bash
# 1. Health endpoint — exercises the DB connection
curl -s https://noon-main.vercel.app/api/health
# Expected: {"service":"api","healthy":true,"checked_at":"..."}

# 2. From your laptop with the NEW credentials (export them to your
#    shell first; do NOT commit them):
export DATABASE_URL="<new value from Supabase>"
node scripts/check-migrations.mjs --strict
# Expected: "Migration check passed"

# 3. gpt-5.5 smoke (independent of DB but proves the deploy is
#    serving traffic):
npm run smoke:gpt-5.5
# Expected: "OK — all checks passed."
```

4. **Service-role surface smoke (added 2026-07-06):** open a client
   workspace conversation with an existing attachment and confirm the
   attachment still loads (exercises Supabase Storage via
   `SUPABASE_SERVICE_ROLE_KEY`). A broken/stale key surfaces here, not
   in the DB health check.

### Step 5 — Update local + teammate envs

Anyone with a local `.env.local` will see their dev environment
break until they update. Send the new connection string via secure
channel (1Password / KeePass shared vault). Do NOT paste it into
Slack, email, or any chat.

For each teammate:

```bash
# In their noon-web checkout:
# Edit .env.local: replace DATABASE_URL, POSTGRES_URL, SUPABASE_URL,
# SUPABASE_ANON_KEY with the new values.
npm run db:check-migrations   # confirms local connectivity
npm test                      # baseline still passes locally
```

### Step 6 — Mark the deadline as resolved

1. Delete this section from `docs/handoff-fase2.md` pending list.
2. Update `~/.claude/projects/.../memory/project_nooncode_warnings.md`
   — remove the "Supabase token leaked" entry.
3. Commit the doc changes ("ops: Supabase keys rotated 2026-MM-DD").
4. Notify the team in your normal ops channel.

---

## Rollback (if the new credentials break production)

The window between Step 2 and Step 3 is the riskiest — old serverless
functions still use the cached old credentials and now Supabase
rejects them.

If Step 4 smoke fails:

1. Do NOT immediately re-rotate. The new credentials are valid; the
   problem is propagation / paste error.
2. Vercel → Deployments → confirm the redeploy used the latest env
   vars (check the deploy timestamp vs your env-var save timestamp).
3. Trigger another redeploy with "Use existing build cache" off.
4. Re-run the smoke. If still failing, paste each env var into a
   one-shot `node -e "console.log(process.env.X)"` to confirm it
   landed correctly (do this in a local shell with the values, NOT
   in CI).
5. Last resort: re-reset at Supabase (Step 1) and re-paste (Step 2).
   Mark the previous values as compromised in your ops log.

---

## What this runbook does NOT cover

- **Stripe webhook secret rotation** — separate runbook (none yet;
  out of scope for the 2026-07-22 deadline).
- **OAuth Google client secret rotation** — managed in Google Cloud
  Console; same `AUTH_GOOGLE_SECRET` env var. Out of scope.
- **NOON_WEBSITE_WEBHOOK_SECRET / NOON_APP_WEBHOOK_SECRET rename**
  — coordinated cross-repo cleanup, separately tracked in handoff
  doc.
- **PITR window implications** — Supabase Point-In-Time-Recovery
  uses internal credentials independent of your project keys.
  Rotation does not affect PITR availability.
