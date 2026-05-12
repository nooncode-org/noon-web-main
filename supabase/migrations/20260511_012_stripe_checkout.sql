-- Stripe Checkout launch slice for Maxwell public proposals.
-- Additive only: existing manual-payment rows remain valid and old proposals
-- without approved_amount_usd stay non-payable until republished by PM review.

ALTER TABLE public.proposal_request
  ADD COLUMN IF NOT EXISTS approved_amount_usd NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS approved_currency TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_paid_at TIMESTAMPTZ;

ALTER TABLE public.payment_event
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_session_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS payload_json JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_event_provider_event
  ON public.payment_event (provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_event_provider_session_confirmed
  ON public.payment_event (provider_session_id)
  WHERE provider_session_id IS NOT NULL AND event_type = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_proposal_request_stripe_checkout_session
  ON public.proposal_request (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
