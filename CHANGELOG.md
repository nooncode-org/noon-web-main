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

## [2026-06-06] — AI MVP milestone receiver (cross-repo, App → NoonWeb)

> **Summary:** Built the inbound receiver for App's post-payment AI MVP
> pipeline milestones (handoff `2026-06-06-noonweb-ai-mvp-milestones-handoff.md`).
> App emits client-safe milestones (`started` / `version-ready` / `escalated`)
> over the same durable HMAC-signed outbound queue as proposal-review-decision
> (ADR-027); until this endpoint existed those deliveries failed and App's queue
> retried into the void. The receiver verifies the signature, validates the §58
> client-safe body, persists idempotently on `(project_id, kind)`, and returns
> 2xx so App can mark the ledger row delivered. This is **PR-A** of the handoff;
> the client-status UI + `project_id`→session mapping is the follow-up **PR-B**.
> PR `feat/ai-mvp-milestone-receiver`.

### Added

- **`app/api/integrations/noon-app/ai-mvp-milestone/route.ts`** — `POST`
  receiver. Reuses `readSignedNoonAppJson` (identical HMAC scheme to
  proposal-review-decision: `${ts}.${rawBody}`, ±5min skew, missing-timestamp
  rejected per the F-1 fix), validates the body, persists, returns 2xx. Honours
  `version_url` only on `version-ready`.
- **`supabase/migrations/20260606_021_ai_mvp_milestone.sql`** — new
  `ai_mvp_milestone` table (`project_id`, `kind`, `version_url`, timestamps),
  `UNIQUE (project_id, kind)` mirroring App's idempotency key for structural
  dedup. RLS + backend-only grants mirror `20260406_004`. Self-registers in
  `schema_migrations`. Additive only.
- **`lib/maxwell/repositories.ts`** — `recordAiMvpMilestone` (idempotent upsert
  on `(project_id, kind)`; `COALESCE` keeps a stored `version_url` from being
  clobbered by a later null; `xmax = 0` distinguishes first-arrival from retry)
  + `getAiMvpMilestonesByProjectId` (source for the PR-B UI) and the
  `AiMvpMilestone` / `AiMvpMilestoneKind` types.
- **`lib/noon-app-integration.ts`** — `noonAppAiMvpMilestonePayloadSchema`
  (Zod, §58 client-safe: only `event` / `kind` / `project_id` / `version_url`).
- **`tests/maxwell/ai-mvp-milestone-webhook.test.ts`** — 19 tests: full
  signature matrix, payload validation, per-kind persistence, version_url
  honoured only on `version-ready`, and dedup replay.

---

## [2026-05-25] — D-slice ADR-023 UI: prototipo decision route built behind flag

> **Summary:** Built the full client-facing surface for the D-slice cross-repo
> flow — route `/maxwell/prototipo/[token]`, Server Component shell, decision
> Client Component, Server Action wiring, GET signed-read helper (Pull B.2),
> a11y scan, and an operator smoke script. Lives behind
> `MAXWELL_PROTOTIPO_DECISION_ROUTE=1` (default OFF) so it can land before
> App-side handlers ship to prod and ops flips the flag after bilateral smoke.
> Backend layer landed earlier the same day (PR `feat/d-slice-prototipo-decision`).
> PR `feat/d-slice-ui-prototipo-decision`.

### Added

- **`lib/maxwell/prototipo-render-fetch.ts`** — `fetchPrototipoRender(token)`
  GET helper. Empty-body HMAC signing (`${timestamp}.` per ADR-024 D1), 2-attempt
  retry loop for 5xx + network errors (per handoff §2.10/§2.11), no retry on 429
  or `AUTH_FAILED`. Returns a discriminated union the route pattern-matches on.
- **`lib/maxwell/prototipo-render-types.ts`** — wire types for App's 200 payload
  per handoff §2.5, 7 error codes (`PROTOTYPE_READ_*` + shared `AUTH_FAILED` +
  `RATE_LIMITED` + `UNKNOWN`), and `mapRenderResultToUxState` (pure mapper to
  11 UX buckets the route renders).
- **`lib/maxwell/prototipo-route-flag.ts`** — `isPrototipoDecisionRouteEnabled()`
  reads `MAXWELL_PROTOTIPO_DECISION_ROUTE === "1"`. Mirrors the
  `isLifecycleEmailsEnabled` pattern.
- **`app/[locale]/maxwell/prototipo/[token]/page.tsx`** — Server Component:
  feature-flag gate → rate-limit (`prototipo.public`, 30 GET/60s/IP, mirrors
  `proposal/[token]`) → fetch via GET helper → map to UX state → render the
  matching shell.
- **`_components/prototipo-frame.tsx`** — sandboxed iframe over `deployedUrl`
  with `srcdoc` fallback over `generatedHtml`. CSP-block fallback link
  always rendered ("Abrir en nueva pestaña" per D-slice plan §10 risk 3).
- **`_components/prior-decision-summary.tsx`** — read-only "ya aceptaste/rechazaste"
  banner with `decision.decidedAt` and optional `notes` echoed on rejected.
- **`_components/error-states.tsx`** — per-bucket copy for the 7 non-ok UX
  variants (terminal/expired/transient/fatal) with tone-keyed surfaces.
- **`_components/decision-panel.tsx`** — Client Component with idle →
  choosing → submitting → success/error state machine. Optional notes
  textarea (UI max 2000 chars, App sanitises). Disabled-during-pending,
  router.refresh() on success so the next render swaps to PriorDecisionSummary.
- **`_actions/submit-decision.ts`** — Server Action wrapping
  `submitPrototipoDecision` (backend helper from prior PR). Reads UA from RSC
  headers (never trusts client), calls `revalidatePath` on ok.
- **`tests/maxwell/prototipo-render-fetch.test.ts`** — 35 tests: happy paths,
  empty-body HMAC signing reproducibility, URL encoding, 6 error codes
  parametrised, status fallbacks, retry behavior (5xx retries, 429/401 do not),
  recovery on 500→200, misconfigured-env returns AUTH_FAILED.
- **`tests/maxwell/prototipo-route-flag.test.ts`** — 4 tests covering the
  feature flag's exact-`"1"` semantics.
- **`tests/visual/prototipo-decision.spec.ts`** — Playwright a11y scan via
  `page.route()` fixture interception. 5 UX states (pending/accepted/rejected/
  superseded/notfound), axe scan with iframes excluded.
- **`scripts/manual/prototipo-decision-smoke.js`** — operator script that
  signs + fires GET (and optionally POST decision) against App. Useful for
  bilateral smoke when App handler ships.
- **`MAXWELL_PROTOTIPO_DECISION_ROUTE`** in `.env.example` (default empty).

### Changed

- **`lib/noon-app-integration.ts`** — extracted `signNoonAppEnvelope(bodyText)`
  and exported `getNoonAppBaseUrl()`. POST helper unchanged in behavior; GET
  helper reuses the same envelope with empty-body input.
- **`playwright.config.ts`** — `webServer.env` now seeds
  `MAXWELL_PROTOTIPO_DECISION_ROUTE=1` + mock `NOON_APP_BASE_URL` and
  `NOON_WEBSITE_WEBHOOK_SECRET` so the prototipo a11y spec can reach the
  route. Other specs unaffected (they hit different paths).
- **`scripts/manual/README.md`** — new row for the smoke script.

### Notes

- Bilateral smoke against App-side backend remains pending (App handler
  iteration is independent — Architecture done 2026-05-25, Backend pending).
  Both contracts (GET ADR-024 + POST ADR-023) are frozen, so NoonWeb side is
  unblocked per the cross-repo handoff.
- The PR stays open for partner review per `feedback_feature_branches_always`;
  do not merge to main without sign-off.

---

## [2026-05-25] — Cleanup: legacy webhook secret removed

> **Summary:** Closed Lista-Web.md #1 — both repos finished the
> `NOON_APP_WEBHOOK_SECRET` → `NOON_WEBSITE_WEBHOOK_SECRET` rename in prod.
> Vercel legacy env eliminated by ops; runtime + integration code simplified
> to canonical-only. Safety-net helper preserved as a commented block per
> `feedback_comment_dont_delete`. PR `chore/cleanup-legacy-webhook-secret`.

### Removed

- **Legacy fallback for `NOON_APP_WEBHOOK_SECRET`** in `lib/server/runtime-env.ts`
  and `lib/noon-app-integration.ts`. Reads canonical only. The
  `buildCheckWithSecretAlternatives` helper is preserved as a commented block
  for future cross-repo rename patterns.
- **Legacy env row** from `.env.example`.

### Changed

- `tests/maxwell/runtime-env.test.ts` — fixture uses canonical name; "accepts
  the legacy" test removed; whitespace-only canonical test inverted to expect
  optional-missing report.
- `tests/maxwell/noon-app-integration.test.ts` — "returns true when only the
  legacy" test inverted to assert legacy is no longer accepted.
- `tests/maxwell/noon-app-webhook.test.ts` — `vi.stubEnv` switched to canonical.
- `project.context.full.md` + `docs/handoff-fase2.md` — cleanup marked complete.

### Operational notes

- Ops deleted `NOON_APP_WEBHOOK_SECRET` from Vercel Production before this PR
  was merged. No downtime expected: canonical was already being read first by
  both runtime-env validation and the integration helper.

---

## [2026-05-19] — Hardening + Quality Layer closure + observability

> **Summary:** Tests grew 513 → 817 (+304). 17 PRs merged across one session.
> Bug surfaced + fixed in same session (G-D2 fail-open hotfix `c9ddf45`).
> Zero known regressions. `main` HEAD: `7f82fe4`.

### Added

- **`.github/PULL_REQUEST_TEMPLATE.md`** — codifies the Why / What
  changes / Tests / Gates / Out-of-scope / Operational notes / Risks
  pattern that delivered 17 zero-confusion PRs this session. Future
  contributors get the structure for free.
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
- **Doc accuracy fix:** `project.context.full.md` previously claimed "no
  hay CI" — `.github/workflows/ci.yml` has actually been in place
  (Node 22, tsc + tests + build + lint, triggers on every push +
  PR to main). Docs (`§2.7 Infra`, the debt table in §11, and the
  §13 pendientes técnicos block) all updated to reflect the real
  state.

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
