# scripts/manual

Operator scripts for ad-hoc smoke testing of external dependencies. **Not part of the test suite** (`npm test` does not run these). They live here, separate from `tests/`, to avoid being mistaken for unit/integration tests.

> For ESM (`.mjs`) operator/CI scripts at the repo's `scripts/` root (including
> the `send-test-*.mjs` email-preview tools), see [`../README.md`](../README.md).
> Those are linted as part of `eslint .`; the CommonJS scripts in **this** folder
> are excluded from ESLint.

## How to run

All scripts read credentials from environment variables. The simplest way is to use Node.js's `--env-file` flag (requires Node 20.6+):

```bash
node --env-file=.env scripts/manual/test-db.js
```

If your Node is older, export vars manually (`export DATABASE_URL=...`) or use `dotenv-cli` from npx.

## Scripts

| Script | Purpose | Required env |
|---|---|---|
| `test-db.js` | Verify postgres.js connects to the configured DB. | `DATABASE_URL` (or `POSTGRES_URL`) |
| `test-rest.js` | Verify Supabase REST endpoint is reachable with the anon key. | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `test-v0-async.js` | Verify v0 SDK async create + poll round-trip. | `V0_API_KEY` |
| `test-v0-create.js` | Verify v0 SDK chat create (no polling). | `V0_API_KEY` |
| `test-v0-poll.js` | Verify v0 SDK eventual consistency on `getById` immediately after create. | `V0_API_KEY` |
| `prototipo-decision-smoke.js` | D-slice ADR-023 bilateral smoke — signs + fires GET signed-read and (optionally) POST decision against App. Pass `--token <share_token>` and optionally `--decision accepted\|rejected`, `--workspace <uuid>`, `--notes "..."`. | `NOON_APP_BASE_URL`, `NOON_WEBSITE_WEBHOOK_SECRET` |

## Conventions

- **Never hardcode credentials.** All scripts must read from `process.env` and exit with an error if the required vars are missing.
- These scripts are excluded from ESLint (see `eslint.config.mjs`) so you can keep them in CommonJS / `require()` style without touching the production lint rules. Convert to ESM only if you have a reason.
- If you find yourself adding a new dependency just to run a smoke check, ask whether it belongs in `package.json` or whether the script should be written as a one-off `curl`.

## History

These scripts were moved here from the repo root on 2026-05-08 (gap #6). Before the move, `test-db.js` and `test-rest.js` contained hardcoded production credentials in plain text — see git commit `4d1843d` (2026-04-23). Those credentials should already be rotated. The current files read from env exclusively.
