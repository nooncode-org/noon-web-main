-- M1 membership billing — persist the Stripe CORRELATION ids for a recurring
-- membership subscription (doc maxwell-commercial-constraints.md §2; master-spec
-- §10.2). See specs/2026-06-21-v3-membership-billing.md (chunk M1) +
-- docs/2026-06-22-v3-membership-m1-architecture.md (C5).
--
-- M0 (migration 029) captured the chosen modality + the engine-derived monthly.
-- M1 actually CHARGES the recurring monthly via a Stripe subscription
-- (mode:"subscription", Option A: activation as add_invoice_items on the first
-- invoice). To route the recurring webhooks (invoice.paid / invoice.payment_failed
-- / customer.subscription.updated|deleted) back to the right proposal, NoonWeb
-- persists the Stripe subscription + customer ids on the proposal.
--
-- IMPORTANT (boundary): these are ONLY correlation ids so NoonWeb can OPERATE
-- Stripe + forward normalized lifecycle events. NoonWeb does NOT persist the
-- client-visible membership STATE here — the App is SoT and exposes it sanitized
-- in the project-status pull (ADR-M1-2). No state column lives on NoonWeb.
--
-- `stripe_subscription_id` is UNIQUE (a proposal maps to at most one
-- subscription) via a partial index that ignores the (common) NULL rows.
--
-- Additive + reversible (DROP COLUMN / DROP INDEX). Self-registers in
-- schema_migrations, mirroring 023/024/025/029.

BEGIN;

ALTER TABLE proposal_request
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE proposal_request
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS proposal_request_stripe_subscription_id_key
  ON proposal_request (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260622_030_proposal_membership_stripe_refs.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
