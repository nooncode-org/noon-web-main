# project.context.core.md - Noon Website / Maxwell Studio

> Last updated: 2026-05-11
> Active session: Website launch slice - Stripe hosted Checkout + launch hardening
> Operating mode: Backend + Frontend + Testing + Hardening

## Product Boundary

- Noon Website and Noon App are separate products in the same ecosystem.
- Work in this repo is Website-only unless the user explicitly expands scope.
- `App-nooncode` must not be modified from this repo/session.
- Website owns the public client experience: marketing pages, Maxwell, public proposal viewing, and client payment.
- Noon App owns collaborator operations: PM review, developer board, post-payment operations, and internal execution.
- Integration between products happens through signed webhooks, not shared UI or shared database assumptions.

## Current Launch Decision

- Launch the current English website before the future v3 redesign.
- Replace manual client payment with Stripe hosted Checkout.
- First launch supports one-time activation payment in USD only.
- Subscriptions/memberships are out of scope for this slice.
- Old proposals without a persisted PM-approved amount are not payable until republished/reapproved.

## Payment Contract

- PM review lives in Noon App.
- Noon App sends review decisions to `POST /api/integrations/noon-app/proposal-review-decision`.
- For approved decisions, Website persists `proposal.amount` and `proposal.currency` on `proposal_request`.
- The canonical charge amount is `proposal_request.approved_amount_usd` + `approved_currency`, not a recalculated pricing estimate.
- Public payment starts through `POST /api/maxwell/checkout` with `public_token`.
- Stripe confirms payment through signed `POST /api/stripe/webhook`.
- Website activates the workspace only after `checkout.session.completed` verifies amount/currency/session/proposal.
- Website then calls the existing Website -> Noon App `payment-confirmed` webhook.

## Current Stack

- Frontend: Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, next-intl.
- Backend: Next.js API routes with `runtime = "nodejs"` and `dynamic = "force-dynamic"` where needed.
- Database: PostgreSQL/Supabase via `postgres.js`; no ORM.
- Auth: NextAuth v5 JWT, Google OAuth with verified email.
- AI/prototypes: OpenAI SDK and v0 SDK.
- Payments: Stripe hosted Checkout and Stripe webhook signatures.
- Tests: Vitest unit/integration plus Playwright visual/a11y specs.

## Stable Modules

- Public site: `app/[locale]/page.tsx`, `app/_components/site/`, `lib/site-config.ts`, `lib/site-tones.ts`.
- Maxwell client flow: `app/[locale]/maxwell/**`, `components/maxwell/**`, `lib/maxwell/**`.
- Public proposal: `app/[locale]/maxwell/proposal/[token]/page.tsx`.
- Review/webhook bridge: `app/api/integrations/noon-app/proposal-review-decision/route.ts`.
- Payment boundary: `app/api/maxwell/checkout/route.ts`, `app/api/stripe/webhook/route.ts`, `lib/maxwell/payment-activation.ts`.

## Critical Rules

1. Do not expose source code, repository access, or technical deliverables before payment.
2. Every public proposal must pass PM review before payment is available.
3. `client_workspace` must not become active without confirmed payment.
4. Stripe webhook processing must be idempotent.
5. Webhook signatures must use raw body verification.
6. Do not silently fall back from approved PM amount to pricing estimates for client payment.
7. Preserve Website/App separation.
8. Do not introduce new infrastructure without explicit need and validation.

## Current Verified Reality

- CI exists in `.github/workflows`.
- Noon App review decision webhook tests exist in `tests/maxwell/noon-app-webhook.test.ts`.
- Stripe Checkout slice adds:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - migration `supabase/migrations/20260511_012_stripe_checkout.sql`
  - checkout route
  - Stripe webhook route
  - public proposal payment CTA
  - shared payment activation service
- Launch hardening slice adds:
  - private/local URL blocking in upgrade URL normalization
  - HTML escaping for contact notification email body
  - prototype iframe `sandbox` and `referrerPolicy`
  - basic security headers in `next.config.mjs`

## Open Risks

- Stripe env vars must be configured in Vercel before preview/production payment tests.
- A real Stripe test-mode checkout and webhook event still need manual preview validation.
- `npm audit` reports 5 vulnerabilities, including high-severity Next/Vite advisories; upgrade should be a controlled dependency slice, not an automatic `audit fix`.
- `auth.ts` still degrades if Google OAuth envs are missing; production fail-fast remains a separate hardening task.
- OpenAI model selection is still hardcoded; `OPENAI_MODEL` remains a future cleanup.
- Observability is still mostly console-based; Sentry or equivalent remains pending.

## Next Recommended Steps

1. Run `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build`.
2. Apply the Stripe migration in the target Supabase database before testing checkout.
3. Configure Stripe env vars in Vercel preview.
4. Validate: Noon App approved proposal -> public proposal -> Stripe Checkout -> webhook -> workspace activation -> Noon App payment-confirmed.
5. Only after preview validation, promote to production.
