# scripts

Root-level operator / CI scripts. Unlike `scripts/manual/` (CommonJS smoke
checks of external dependencies, **excluded from ESLint**), these are ESM
(`.mjs`), **are linted** as part of the normal `eslint .` gate, and each is
self-documenting via a header docstring. They are NOT part of the test suite
(`npm test` does not run them).

For ad-hoc smoke checks of external services in CommonJS style, see
[`scripts/manual/README.md`](./manual/README.md).

## How to run

Most scripts read credentials from the environment. The email-preview scripts
auto-load `.env.local` (falling back to `.env`); the others expect the vars to
be present, which you can supply with Node's `--env-file` flag (Node 20.6+):

```bash
node scripts/send-test-lifecycle-emails.mjs --type=payment --to=you@example.com
node --env-file=.env scripts/check-migrations.mjs
```

## Scripts

| Script | Purpose | Required env |
|---|---|---|
| `send-test-proposal-email.mjs` | Send a one-off TEST "Your proposal is ready" email (mirrors `sendProposalEmail`) to preview the inbox + pay flow. | `RESEND_API_KEY`, `MAIL_FROM` |
| `send-test-lifecycle-emails.mjs` | Send one-off TEST copies of the post-proposal emails — `--type=payment` (B8 #2), `--type=workspace` (B8 #3), `--type=rejected` (decline; shared by reject/cancel). Mirrors `lifecycle-emails.ts` + `proposal-email.ts` byte-for-byte. Supports `--dry-run` (no send, no creds) and `--twice` (verify Resend idempotency-key dedupe). | `RESEND_API_KEY`, `MAIL_FROM` |
| `check-migrations.mjs` | Verify every migration in `supabase/migrations` is applied to the DB; exits non-zero if any are missing. | `DATABASE_URL` |
| `gdpr-hard-delete.mjs` | GDPR right-to-erasure CLI — hard-delete one studio session and every row that references it, FK-safe, in one transaction. Supports `--dry-run` and an explicit `--yes` gate. | `DATABASE_URL` (or `POSTGRES_URL`) |
| `bundle-stats-summary.mjs` | Summarize the Next.js build output into a compact first-load-JS-per-route table. | none |
| `smoke-gpt-5.5.mjs` | One-shot smoke of the OpenAI chat path: send a tiny prompt and print the reply. | `OPENAI_API_KEY` (optionally `OPENAI_MODEL` / `MAXWELL_CHAT_MODEL`) |

`check-migrations.lib.mjs` and `gdpr-hard-delete.lib.mjs` are internal helper
modules imported by their respective CLIs (and unit-tested under `tests/`); they
are not meant to be run directly.

## Email-preview scripts — notes

The two `send-test-*.mjs` scripts hit the Resend HTTP API directly, mirroring
`lib/maxwell/email-config.ts` (`sendViaResend`) and the individual senders, so
the preview matches what a real client receives (same subject, copy, HTML,
idempotency key, tags). They do **not** touch the database or the Noon App, and
`send-test-lifecycle-emails.mjs` deliberately does **not** read
`MAXWELL_LIFECYCLE_EMAILS` — that gate guards the production wiring, not this
operator preview. The only side effect is the Resend email(s) to `--to`.

The workspace link in the payment / workspace emails is built as
`{base}/{locale}/maxwell/workspace/{sessionId}`, where `{base}` comes from
`--base` (or `MAXWELL_PUBLIC_BASE_URL` / `NEXT_PUBLIC_SITE_URL`). This mirrors
`buildWorkspaceUrl` in `lib/maxwell/public-url.ts` — the workspace portal lives
in NoonWeb (see App ADR-010 / ADR-012), not in the App.

> **Resend domain note:** with an unverified Resend domain, Resend only delivers
> to the account owner's address; sending to any other recipient returns 403. A
> verified `MAIL_FROM` domain (e.g. `nooncode.dev`) delivers to any address.

## Conventions

- **Never hardcode credentials.** Read from `process.env` (or `.env.local`) and
  exit with a clear error if a required var is missing.
- Keep each script self-documenting with a header docstring (purpose, usage,
  required env), as the existing scripts do.
- Prefer a one-off `fetch` / SDK call over adding a dependency just to run a
  check. If you do need a dep, ask whether it belongs in `package.json`.
