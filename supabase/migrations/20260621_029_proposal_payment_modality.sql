-- M0 membership billing — capture the client's chosen payment modality + the
-- recurring monthly that goes with it (doc maxwell-commercial-constraints.md §2
-- "PRINCIPAL — Membresía"; master-spec §10.2). See
-- specs/2026-06-21-v3-membership-billing.md (chunk M0).
--
-- Today only the one-time activation is billed (Stripe mode:"payment", the
-- `approved_amount_usd`). The proposal already advertises a membership monthly
-- (proposal-rules.ts PRICING_TABLE) but the system never captured WHICH modality
-- the client chose nor the monthly amount. These two additive columns close that
-- gap (M0): the checkout persists the chosen modality + the engine-derived
-- monthly. NO recurring charge yet — the membership monthly is coordinated
-- manually by the PM until M1 (Stripe subscriptions).
--
-- `payment_modality` is NoonWeb-owned, chosen by the client at checkout
-- (one_time | membership). `monthly_amount_usd` is the engine-derived recurring
-- amount, set only when modality = membership (NULL otherwise). The CHARGED
-- activation stays `approved_amount_usd` (PM-approved), unchanged.
--
-- Additive + reversible (DROP COLUMN). Self-registers in schema_migrations,
-- mirroring 023/024/025.

BEGIN;

ALTER TABLE proposal_request
  ADD COLUMN IF NOT EXISTS payment_modality TEXT;

ALTER TABLE proposal_request
  ADD COLUMN IF NOT EXISTS monthly_amount_usd NUMERIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposal_request_payment_modality_check'
  ) THEN
    ALTER TABLE proposal_request
      ADD CONSTRAINT proposal_request_payment_modality_check
      CHECK (payment_modality IS NULL OR payment_modality IN ('one_time', 'membership'));
  END IF;
END $$;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260621_029_proposal_payment_modality.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
