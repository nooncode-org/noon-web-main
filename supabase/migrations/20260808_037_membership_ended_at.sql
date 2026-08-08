-- Start the retention clock: record WHEN a membership ended.
--
-- The portal tells a client, the day their membership ends: "your project,
-- conversation and files stay saved for 12 months". Nothing enforced that,
-- and nothing could — the membership state is not stored here at all. It is
-- fetched from the Noon App on every render and thrown away. So the website
-- had no way of knowing when anyone's twelve months began.
--
-- This is that missing fact, and nothing more: the first moment WE observed the
-- membership as ended. Deliberately ours rather than the App's, because a
-- retention clock that can move when another system re-computes something is
-- not a clock. Once set it stays set; it is cleared only when the client comes
-- back (see clearMembershipEndedAt).
--
-- The column alone deletes nothing. The sweep that reads it
-- (lib/maxwell/data-retention.ts) is off unless DATA_RETENTION_MONTHS is set,
-- and even then only reports until DATA_RETENTION_APPLY=1.

BEGIN;

ALTER TABLE public.client_workspace
  ADD COLUMN IF NOT EXISTS membership_ended_at TIMESTAMPTZ;

COMMENT ON COLUMN public.client_workspace.membership_ended_at IS
  'First time the Noon App reported this membership as ended. NULL while active. Start of the data-retention window.';

-- Partial: the sweep only ever asks for rows where it is set, and in a healthy
-- account base that is the small minority.
CREATE INDEX IF NOT EXISTS idx_client_workspace_membership_ended_at
  ON public.client_workspace (membership_ended_at)
  WHERE membership_ended_at IS NOT NULL;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260808_037_membership_ended_at.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
