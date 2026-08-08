-- Realign the proposal_review_event action list with what actually happens.
--
-- Found on 2026-08-08 by the first browser test to load a proposal page against
-- a database built purely from these migrations: opening a proposal threw
-- "violates check constraint proposal_review_event_action_check". The insert
-- was 'opened'.
--
-- Two separate problems, both invisible until a schema was built from scratch:
--
--   1. DRIFT. Production's live constraint allows 'opened'; the last migration
--      that touched it (20260425_001) does not list it. Someone widened
--      production by hand and the file never caught up. So a fresh database —
--      a new environment, a restore, a test run — does NOT match production and
--      breaks the first time a client opens their proposal.
--
--   2. A GAP IN BOTH. Six actions the code can write are missing from
--      production too: the whole SLA family (reminder, escalated, auto_sent,
--      blocked_special, blocked_delivery) and noon_app_handoff_skipped. Those
--      paths exist in lib/maxwell/proposal-review-sla.ts and would throw the
--      day an SLA reminder fires. Production has zero sla_* rows, which is
--      consistent with never having fired rather than with working.
--
-- This list is the union of what production currently stores and every action
-- the code can emit (verified against the call sites of
-- appendProposalReviewEvent). Nothing speculative was added: a value nobody
-- writes is a value nobody can validate.

BEGIN;

ALTER TABLE public.proposal_review_event
  DROP CONSTRAINT IF EXISTS proposal_review_event_action_check;

ALTER TABLE public.proposal_review_event
  ADD CONSTRAINT proposal_review_event_action_check CHECK (action IN (
    -- review desk
    'created',
    'approve_and_send',
    'edit',
    'edited',
    'return_to_draft',
    'returned',
    'escalate',
    'reviewed',
    'approved',
    'review_flags_detected',
    'new_version_created',
    -- delivery to the client
    'sent',
    'opened',
    'delivery_failed',
    -- service-level automation (lib/maxwell/proposal-review-sla.ts)
    'sla_reminder',
    'sla_escalated',
    'sla_auto_sent',
    'sla_blocked_special',
    'sla_blocked_delivery',
    -- the bridge to the Noon App
    'noon_app_inbound_sent',
    'noon_app_inbound_failed',
    'noon_app_handoff_skipped',
    'noon_app_approved',
    'noon_app_changes_requested',
    'noon_app_rejected',
    'noon_app_cancelled',
    'noon_app_payment_sent',
    'noon_app_payment_failed'
  ));

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260808_036_proposal_review_actions_realign.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
