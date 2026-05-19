-- B19 — Audit log for public proposal page access.
--
-- The /maxwell/proposal/[token] RSC is the only public surface that
-- exposes a Noon-generated proposal to a non-authenticated visitor.
-- Pre-B19 we had rate-limiting (B19 first half, already shipped) but
-- no append-only audit trail. Compliance (GDPR Art. 32 — "security of
-- processing") asks for being able to reconstruct who accessed what
-- and when, even if we cannot prove identity, so this table stores
-- a minimal redacted record per access event.
--
-- Design decisions:
--
-- 1. `client_ip_hash` is sha256(ip).slice(0,16) computed in Node. We do
--    NOT store the raw IP. Hashing with no salt is acceptable here
--    because the goal is correlation (same IP across N events), not
--    re-identification — a salt would make events from the same IP
--    impossible to group, defeating the audit purpose. The 16-char
--    truncation reduces the table size and is still collision-resistant
--    at our expected volumes (thousands per month).
--
-- 2. `user_agent_truncated` is the raw header truncated to 200 chars
--    after `replace(/\s+/g, " ").trim()`. UA strings rarely carry PII
--    but can be long (bot strings up to 500+ chars). 200 is enough to
--    discriminate browser families + bot patterns.
--
-- 3. `action` is a constrained enum-via-CHECK rather than a Postgres
--    ENUM type, to make future additions a single ALTER without an
--    enum migration dance.
--
-- 4. No FK to `proposal_request(id)` because audits should survive even
--    if the proposal row is hard-deleted (GDPR Art. 17). `proposal_token`
--    is the stable public identifier; if we eventually want to join,
--    repositories can left-join opportunistically.
--
-- 5. Append-only: no `updated_at`, no row mutation paths. The repository
--    helper only INSERTs.

CREATE TABLE IF NOT EXISTS public.proposal_access_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_token  TEXT NOT NULL,
  accessed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_ip_hash  TEXT,
  user_agent_truncated TEXT,
  response_status SMALLINT NOT NULL,
  action          TEXT NOT NULL
);

-- Index on (proposal_token, accessed_at desc) — supports the most common
-- audit query ("show recent accesses for this proposal"). Includes
-- response_status to make filtering ("show only 4xx/5xx for token X")
-- index-only when running ad-hoc compliance queries.
CREATE INDEX IF NOT EXISTS idx_proposal_access_audit_token_time
  ON public.proposal_access_audit (proposal_token, accessed_at DESC)
  INCLUDE (response_status, action);

-- Constraint on action: documents the known values without locking us
-- in to an ENUM type. Add new values by ALTER COLUMN drop + recreate
-- with extended set.
ALTER TABLE public.proposal_access_audit
  ADD CONSTRAINT proposal_access_audit_action_valid
  CHECK (action IN (
    'page_view',           -- RSC render of the public proposal page
    'page_view_blocked',   -- RSC blocked by rate-limit or unknown token
    'payment_evidence',    -- POST submit_payment_evidence
    'status_change'        -- status mutation via Noon App webhook
  ));

-- Self-register in schema_migrations (pattern established in B45 / migration 013).
INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260518_015_proposal_access_audit.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;
