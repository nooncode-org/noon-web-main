# project.context.core.md - Noon Website / Maxwell Studio

> Last updated: 2026-05-13
> Active session: EN-only soft launch hardening from `NoonWeb Roadmap.md` and `NoonWeb_Roadmap_Gaps_v3.md`
> Operating mode: Website-only implementation, with App coordination only through existing contracts

## Active Roadmap Inputs

- `C:\Users\white\Downloads\NoonWeb Roadmap.md` is the primary decision source for the current launch.
- `C:\Users\white\Downloads\NoonWeb_Roadmap_Gaps_v3.md` is supporting context for gaps and future v3 work.
- Do not use prior Stripe-first decisions as launch truth unless the roadmap changes.
- Do not modify `App-nooncode` unless a verified cross-project contract requires it.

## Product Boundary

- Noon Website and Noon App are separate products in the same ecosystem.
- Website owns the public client experience: marketing pages, Maxwell, public proposal viewing, client payment evidence, and client workspace entry.
- Noon App owns collaborator operations: PM review, developer board, post-payment operations, and internal execution.
- Integration between products happens through signed webhooks and documented contracts, not shared UI or shared database assumptions.

## Current Launch Decision

- Launch the current English website before the future v3 redesign.
- Initial launch is EN-only; `/es`, `/fr`, and `/de` redirect to `/en`.
- Fase 1 payment uses manual `submit_payment_evidence`, not Stripe Checkout.
- Stripe Checkout code may exist in the repository, but it is not the active Fase 1 payment path unless the roadmap is explicitly changed.
- Public launch should happen after the current scope passes local gates and production env/runtime checks.

## Payment Contract

- PM review lives in Noon App.
- Noon App sends review decisions to `POST /api/integrations/noon-app/proposal-review-decision`.
- A public proposal can receive payment evidence only after it is sent or payment-pending.
- Client evidence is submitted through `POST /api/maxwell/payment` with `action: "submit_payment_evidence"` and either `public_token` or `proposal_request_id`.
- The proposal owner must be authenticated, or an authorized reviewer session must be present.
- Submitted evidence moves the proposal to `payment_under_verification`.
- A reviewer still verifies payment through the internal payment actions before workspace activation.
- `client_workspace` must not become active before verified payment.

## Current Stack

- Frontend: Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, next-intl.
- Backend: Next.js API routes with `runtime = "nodejs"` and `dynamic = "force-dynamic"` where needed.
- Database: PostgreSQL/Supabase via `postgres.js`; no ORM.
- Auth: NextAuth v5 JWT, Google OAuth with verified email.
- AI/prototypes: OpenAI SDK and v0 SDK.
- Tests: Vitest unit/integration plus Playwright specs where present.

## Stable Modules

- Public site: `app/[locale]/page.tsx`, `components/landing/**`, `lib/site-config.ts`, `lib/site-tones.ts`.
- Maxwell client flow: `app/[locale]/maxwell/**`, `components/maxwell/**`, `lib/maxwell/**`.
- Public proposal: `app/[locale]/maxwell/proposal/[token]/page.tsx`.
- Review/webhook bridge: `app/api/integrations/noon-app/proposal-review-decision/route.ts`.
- Payment boundary: `app/api/maxwell/payment/route.ts`, `lib/maxwell/payment-activation.ts`.
- Launch infra: `proxy.ts`, `next.config.mjs`, `vercel.json`, `app/sitemap.ts`, `app/robots.ts`.

## Critical Rules

1. Do not expose source code, repository access, or technical deliverables before payment.
2. Every public proposal must pass PM review before payment evidence is useful.
3. Do not activate a workspace before verified payment.
4. Preserve Website/App separation.
5. Return stable `data.code`/`code` values for client-handled errors.
6. Keep public launch EN-only until the roadmap explicitly enables other locales.
7. Do not introduce new infrastructure without a concrete launch requirement and validation path.
8. Docs must reflect implemented reality, not intention.

## Current Verified Reality

- CI exists in `.github/workflows`.
- Noon App review decision webhook tests exist in `tests/maxwell/noon-app-webhook.test.ts`.
- Private/local URL blocking exists in upgrade URL normalization.
- Contact notification email HTML is escaped.
- Prototype iframe is sandboxed and uses `referrerPolicy`.
- `review-sla` accepts `REVIEW_API_SECRET` or `CRON_SECRET`.
- The active soft-launch payment path is manual evidence submission.

## Open Risks

- The live Supabase/Vercel runtime must be checked before public launch.
- Stripe env vars may still exist from a prior slice; they are not launch-critical for Fase 1 manual evidence.
- `npm audit` has reported high-severity dependency advisories before; upgrade must be a controlled dependency slice.
- Observability is still basic; Sentry or equivalent remains launch hardening if enabled.
- v3 remains deferred until after the current EN-only launch unless the roadmap is replaced.

## Next Recommended Steps

1. Finish the Fase 1 implementation slice.
2. Run `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build`.
3. Validate the smoke path: sign in -> Maxwell chat -> prototype -> proposal -> payment evidence -> internal verification -> workspace.
4. Confirm Vercel envs and Supabase migrations only after local gates pass.
5. Push/merge only from the Website repo; keep App changes separate if ever needed.
