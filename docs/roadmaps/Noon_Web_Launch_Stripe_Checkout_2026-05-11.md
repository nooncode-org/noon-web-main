# Noon Web Launch - Stripe Checkout Slice

Date: 2026-05-11
Repo: `C:\Users\white\Documents\Codex\nooncode-org\noon-web-main`
Scope: Website only. Do not modify `App-nooncode` in this slice.

## Launch Direction

- Ship the current English website before the future v3 redesign.
- Replace manual client-side payment confirmation with Stripe hosted Checkout.
- Keep Website and App as separate products connected by signed webhooks.
- First launch charges only a one-time activation payment in USD.

## Implemented Contract

- Noon App remains the PM review system.
- Website receives PM review decisions at `POST /api/integrations/noon-app/proposal-review-decision`.
- Approved decisions persist the PM-approved amount/currency on `proposal_request`.
- Public proposal payment starts at `POST /api/maxwell/checkout`.
- Stripe confirms payment at `POST /api/stripe/webhook`.
- Payment activation is centralized in `lib/maxwell/payment-activation.ts`.
- Website sends the existing `payment-confirmed` webhook to Noon App only after Stripe confirms payment.

## Data Changes

Migration: `supabase/migrations/20260511_012_stripe_checkout.sql`

- Adds approved amount/currency and Stripe identifiers to `proposal_request`.
- Adds Stripe/provider event metadata to `payment_event`.
- Adds partial unique indexes for idempotent webhook processing.

## Required Environment

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Existing Noon App bridge envs remain required for post-payment handoff:
  - `NOON_APP_BASE_URL`
  - `NOON_APP_WEBHOOK_SECRET`

## Validation Checklist

1. Run local gates: lint, typecheck, test, build.
2. Apply the Stripe migration in the preview database.
3. Configure Stripe env vars in Vercel preview.
4. Create or mock a PM-approved proposal with positive USD amount.
5. Open the public proposal and start Stripe Checkout.
6. Complete Stripe test payment.
7. Confirm webhook marks proposal paid, converts session, activates workspace, and calls Noon App `payment-confirmed`.
8. Replay the same Stripe event and confirm no duplicate workspace/payment activation occurs.

## Dependency Risk

- `npm audit` currently reports 5 vulnerabilities: 1 low, 2 moderate, 2 high.
- The high-risk production blocker is the Next.js/Vite advisory group.
- Do not run broad `npm audit fix` blindly before launch.
- Recommended next slice: controlled upgrade of `next`, `next-intl`, and affected dev tooling, followed by lint/test/build and visual smoke checks.

## Out Of Scope

- Website v3 redesign.
- Subscriptions or memberships.
- Noon App UI changes.
- Shared database between Website and App.
- New infrastructure beyond Stripe.
