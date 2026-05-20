# Changelog

All notable changes to `noon-web-main` are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version numbers follow semantic versioning loosely — we use **session date**
as the release identifier because the project ships continuously to Vercel
and there's no formal version cut.

For the operational session log (what was done day-by-day with rationale),
see `docs/handoff-fase2.md`. For the architectural state, see
`project.context.full.md`.

---

## [2026-05-19] — Hardening + Quality Layer closure + observability

> **Summary:** Tests grew 513 → 817 (+304). 17 PRs merged across one session.
> Bug surfaced + fixed in same session (G-D2 fail-open hotfix `c9ddf45`).
> Zero known regressions. `main` HEAD: `7f82fe4`.

### Added

- **B14 GDPR Art.17 hard-delete CLI** (`scripts/gdpr-hard-delete.mjs` +
  `scripts/gdpr-hard-delete.lib.mjs`). Append-only audit ledger
  `gdpr_deletion_log` (migration `20260519_016`). 2-person approval
  procedural workflow. Anonymises Stripe payment identifiers BEFORE
  cascade delete. Snapshot file written under `.gitignore`d
  `gdpr-snapshots/` for rollback window. **Runbook:**
  `docs/gdpr-runbook.md`. (`1b28907`)
- **B8 #2/#3 lifecycle emails** — Payment received + Workspace ready
  templates in `lib/maxwell/lifecycle-emails.ts`. Gated by
  `MAXWELL_LIFECYCLE_EMAILS=1` env (defaults OFF — safe to merge
  before Resend domain verification finalises). (`606cbfb`)
- **B8 wiring** in `confirmProposalPayment` — both emails fire-and-forget
  after each fresh activation, race-safe, never blocks the payment
  flow. Idempotent retries skip (Resend de-dupes on idempotency-key
  anyway). (`a532889`)
- **v3 contracts prep** — `lib/constants/project-types.ts` (canonical
  vocabulary + legacy platform mapping) + `lib/security/project-isolation.ts`
  (denylist + `sanitizeForClient` + dev guard `assertNoInternalFields`).
  Purely additive. (`a3ca787`)
- **v3 isolation guards** wired in 3 client-facing read routes —
  `GET /api/maxwell/studio/session`, `GET /api/maxwell/studio/sessions`,
  `GET /api/maxwell/workspace` (client path only). Gated by
  `NODE_ENV !== "production"` so they run in dev + CI as a regression
  net, no-op in prod. (`5f69a7f`)
- **G-D2 LLM budget tracker** — multi-provider (OpenAI + Anthropic + v0),
  `lib/server/llm-budget.ts` + `lib/server/llm-pricing.ts` + migration
  `20260520_017_llm_budget_usage.sql`. Race-safe via
  `pg_advisory_xact_lock`. Soft alerts at 50%/80%, hard-stop at 100%
  ($200/month default, override via `LLM_BUDGET_USD_PER_MONTH`).
  Designed as anomaly detection (the real per-user/per-month throttle
  lives in B11 `lib/maxwell/prototype-quota.ts`). (`a196a12`)
- **G-D2 admin endpoint** — `GET /api/maxwell/admin/llm-budget` for ops
  dashboard. Same auth gate as `/maxwell/review*` (Bearer or
  REVIEW_ALLOWED_EMAILS). Returns total + by_category + by_provider +
  thresholds + derived status. (`7e9447e`)
- **Ops toolkit** — `scripts/smoke-gpt-5.5.mjs` for production model
  verification + 3 runbooks: `docs/smoke-gpt-5.5-runbook.md`,
  `docs/supabase-key-rotation-runbook.md` (for 2026-07-22 deadline),
  `docs/cross-repo-v3-contracts-app-mirror.md` (spec for App-side
  mirror). (`0b4743b`)
- **`npm run smoke:gpt-5.5`** script alias. (`0b4743b`)
- **Bundle + CVE audit report** — `docs/bundle-and-cve-audit-2026-05-19.md`.
  Bundle healthy (1.7 MB total chunks, framework-dominated). CVE
  finding: postcss < 8.5.10 transitive of Next 16, real exposure ≈ 0
  in our usage (build-time only). (`0ff140a`)
- **Tests +148 across the session** breaking down as:
  - +62 cubriendo 5 routes Maxwell sin coverage (`session`,
    `prototype`, `proposal`, `message-feedback`, `review-sla`)
    (`b67a875`)
  - +13 cubriendo `contact` + `health/db` routes (`7e9447e`)
  - +14 cubriendo `upgrade` entry routes (`43ac889`)
  - +59 cubriendo 6 `upgrade` sub-action routes — `analyze` / `audit`
    / `generate` / `handoff` / `proposal` / `question` (`a487a09`)
  - Plus G-D2 + admin endpoint tests baked into their respective PRs
- **Piedra cross-repo handoff doc** — `docs/handoff-piedra-2026-05-19.md`
  with App-side actionable items front-loaded.

### Changed

- **OpenAI default model bumped from `gpt-4.1` → `gpt-5.5`**. New helper
  `resolveDefaultOpenAIModel()` in `lib/api-ia.ts` reads
  `OPENAI_DEFAULT_MODEL` env on every call → hot-swap rollback without
  redeploy. Cost note: ~5x input, ~3x output vs `gpt-4.1`. Smoke
  harness in `scripts/smoke-gpt-5.5.mjs` confirms behaviour. (`206f63f`)
- **`chatWithOpenAI` accepts `category` + `requestId` params** for G-D2
  budget attribution. 8 callers tagged: `chat`, `brief_extractor`,
  `style_classifier`, `proposal_generator`, `upgrade_analyzer`,
  `upgrade_generator` (×2 sites). v0 helpers tagged
  `v0_prototype_create` / `v0_prototype_update`. (`a196a12`)
- **`project.context.full.md` refreshed** — §2.3 (IA: gpt-5.5 default +
  rollback env), §2.5 (tests baseline 13 → 633), §2.7 (Vercel/Sentry/
  Upstash status), §13 (full rewrite — cronología + 3 buckets de
  pendientes). (`2188948`)
- **`docs/handoff-fase2.md` updated** with all session merges + baseline
  refreshed for fresh-session continuity.

### Fixed

- **🚨 G-D2 fail-open hotfix** (`c9ddf45`). The G-D2 PR (`a196a12`)
  queried the new `llm_budget_usage` table in `assertBudgetAvailable()`.
  Without migration 017 applied to prod, every Maxwell call would have
  500'd. Hotfix: catch ANY DB error in `assertBudgetAvailable`, log
  critical, and **fail open** (allow the LLM call). The real per-user
  / per-month throttle is enforced by B11 `prototype-quota.ts` (15
  prototypes/month total), so fail-open's worst case is a few extra
  dollars of spend while ops applies the migration — vs the
  fail-closed worst case of Maxwell entirely down. The legitimate
  `LLMBudgetExceededError` is still re-thrown — only infra errors fail
  open. Tested with 2 dedicated regression cases.
- **`lib/maxwell/prototype/route.ts`** — dropped unused
  `const updatedSession = await incrementCorrectionsUsed(...)`
  assignment. The side-effect (increment) is what matters; the return
  value was never read. Replaced with a comment explaining that the
  version commit now lives in the poll endpoint. (`7f82fe4`)

### Removed

- **Dead carousel UI block** in `components/landing/hero-section.tsx` —
  `promptScrollerRef` declared but never attached to any JSX element,
  plus the `canScrollPromptsLeft/Right` state pair (writes only, no
  reads), plus `handlePromptCarouselAdvance/Back` handlers (never
  wired to any button), plus the useEffect that maintained scroll
  state. ~25 lines of dead UI logic running on every mount + window
  resize for nothing. Looks like a feature that was reverted from the
  JSX but the supporting state was never cleaned up. (`7f82fe4`)
- **Unused imports** across 6 files surfaced by ESLint
  `no-unused-vars` sweep: `getLocale` (layout), `z` (prototype/poll),
  `createStudioVersion` + `appendStudioMessage` (prototype),
  `UpgradeEvent` (upgrade/repositories), `vi` + `beforeEach`
  (api-smoke test). Re-run of the sweep post-cleanup returns 0
  findings. (`7f82fe4`)
- **`docs/website-missing-items.txt`** — pre-FASE-0 wish list (118
  lines). Every item in it has been shipped (Maxwell Studio integration,
  contact form, legal pages, social URLs, etc.). The file was
  misleading future maintainers into thinking work was pending.
  Dangling reference in `project.context.full.md` §15 also cleaned.
  (`7f82fe4`)

### Security

- **B14 GDPR hard-delete CLI** (see Added) — enables Art.17 "right to
  be forgotten" compliance. Email stored as sha256-truncated hash
  (16 chars) in the audit log; raw email never persisted.
- **v3 wiring guards** (see Added) — `assertNoInternalFields` in 3
  client-facing read routes locks in the "no internal fields leak"
  invariant. Future regressions caught at CI time, not prod.
- **CVE audit** (see Added) — postcss < 8.5.10 transitive of Next 16
  surfaced. Real exposure ≈ 0 in our usage. Documented in audit
  report; will resolve when Next bumps its internal dep.

### Operational follow-ups (NOT a code change — for visibility)

Pending owner / ops actions that complete the value of this session:

- **Apply migration `20260520_017_llm_budget_usage.sql`** to Supabase
  prod → activates the LLM budget ledger
- **Set `MAXWELL_LIFECYCLE_EMAILS=1`** in Vercel → activates B8 emails
- **Smoke gpt-5.5 in prod** via `npm run smoke:gpt-5.5` with prod key
- **Cross-repo:** mirror v3 contracts in `App-nooncode` per
  `docs/cross-repo-v3-contracts-app-mirror.md`
- **Calendar:** Supabase keys rotation 2026-07-22 per
  `docs/supabase-key-rotation-runbook.md`

---

## [2026-05-18] — F-1 mirror fix + B28 polling + audit

Inherited state before this session started. Details in
`docs/handoff-fase2.md`. Brief:

- F-1 HMAC timestamp-required mirror fix (cross-repo security follow-up)
- B28 polling UX improvement
- npm audit clean-up
- `main` HEAD reached `b4ab857`, tests 513

---

## [2026-05-17 and earlier] — FASE 2 hardening + Bloque 11 Quality Layer

PR #13 mergeado por nooncode-tech. 17 commits de hardening cubriendo
B-series (B11 quota race, B19 audit, B21 rate-limit, B22 mobile fallback
banner, B42 Sentry instrumentation, others), plus Bloque 11 Maxwell
Quality Layer (gpt-4.1 default at the time, 24 style packs, brief
extractor, prototype-brief assembly). Tests reached 491-513 range.

Detail in git log + `docs/handoff-fase2.md` § "Cronología abreviada".

---

## [2026-04 and earlier] — FASE 1 baseline

- SQLite → Postgres migration completed
- Cola de revisión humana (`/maxwell/review`) + signed handoff to Noon App
- Webhook entrante HMAC-SHA256 with anti-replay
- Auth Google with allowlist + Bearer dual
- Soft delete on `studio_session`

Detail in `project.context.full.md` § 13 + roadmaps históricos in
`docs/roadmaps/`.
