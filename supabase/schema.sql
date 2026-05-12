-- ============================================================================
-- Noon — Greenfield schema for Supabase (PostgreSQL)
-- Use this file only for empty environments.
-- Existing environments must apply the files in /supabase/migrations first.
-- ============================================================================

-- contact_leads
CREATE TABLE IF NOT EXISTS contact_leads (
  id               TEXT PRIMARY KEY,
  inquiry          TEXT NOT NULL,
  contact_type     TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  email            TEXT NOT NULL,
  brief            TEXT NOT NULL,
  budget_range     TEXT,
  timeline         TEXT,
  source           TEXT,
  ip_hash          TEXT,
  user_agent       TEXT,
  origin_host      TEXT,
  status           TEXT NOT NULL DEFAULT 'new',
  created_at       TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_leads_created_at ON contact_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_leads_inquiry ON contact_leads (inquiry);
CREATE INDEX IF NOT EXISTS idx_contact_leads_ip_hash_created_at ON contact_leads (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_leads_email_created_at ON contact_leads (email, created_at DESC);

-- maxwell_sessions (legacy modal flow)
CREATE TABLE IF NOT EXISTS maxwell_sessions (
  id                        TEXT PRIMARY KEY,
  prompt                    TEXT NOT NULL,
  source                    TEXT,
  status                    TEXT NOT NULL DEFAULT 'captured',
  first_prompt_captured_at  TIMESTAMPTZ NOT NULL,
  updated_at                TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_maxwell_sessions_updated_at ON maxwell_sessions (updated_at DESC);

-- studio_session
CREATE TABLE IF NOT EXISTS studio_session (
  id                    TEXT PRIMARY KEY,
  initial_prompt        TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'intake',
  owner_email           TEXT,
  owner_name            TEXT,
  owner_image           TEXT,
  project_type          TEXT,
  goal_summary          TEXT,
  complexity_hint       TEXT,
  language              TEXT NOT NULL DEFAULT 'en',
  corrections_used      INTEGER NOT NULL DEFAULT 0,
  max_corrections       INTEGER NOT NULL DEFAULT 2,
  proposal_requested_at TIMESTAMPTZ,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL,

  CONSTRAINT studio_session_status_check CHECK (status IN (
    'intake', 'clarifying', 'generating_prototype', 'prototype_ready',
    'revision_requested', 'revision_applied', 'approved_for_proposal',
    'proposal_pending_review', 'proposal_sent', 'converted'
  )),
  CONSTRAINT studio_session_corrections_check CHECK (corrections_used <= max_corrections),
  CONSTRAINT studio_session_max_corrections_positive_check CHECK (max_corrections > 0)
);

CREATE INDEX IF NOT EXISTS idx_studio_session_updated_at ON studio_session (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_session_owner_email ON studio_session (owner_email, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_session_owner_active
  ON studio_session (owner_email, updated_at DESC)
  WHERE deleted_at IS NULL;

-- studio_message
CREATE TABLE IF NOT EXISTS studio_message (
  id                TEXT PRIMARY KEY,
  studio_session_id TEXT NOT NULL REFERENCES studio_session(id) ON DELETE CASCADE,
  role              TEXT NOT NULL,
  message_type      TEXT NOT NULL DEFAULT 'chat',
  content           TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL,

  CONSTRAINT studio_message_role_check CHECK (role IN ('user', 'assistant', 'system')),
  CONSTRAINT studio_message_type_check CHECK (message_type IN (
    'chat', 'thinking', 'correction_request', 'prototype_announcement',
    'approval', 'proposal_request', 'system_event'
  ))
);

CREATE INDEX IF NOT EXISTS idx_studio_message_session ON studio_message (studio_session_id, created_at ASC);

-- studio_message_feedback
CREATE TABLE IF NOT EXISTS studio_message_feedback (
  id                TEXT PRIMARY KEY,
  studio_message_id TEXT NOT NULL REFERENCES studio_message(id) ON DELETE CASCADE,
  studio_session_id TEXT NOT NULL REFERENCES studio_session(id) ON DELETE CASCADE,
  viewer_email      TEXT NOT NULL,
  feedback          TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL,

  CONSTRAINT studio_message_feedback_value_check CHECK (feedback IN ('up', 'down')),
  CONSTRAINT studio_message_feedback_message_viewer_key UNIQUE (studio_message_id, viewer_email)
);

CREATE INDEX IF NOT EXISTS idx_studio_message_feedback_session
  ON studio_message_feedback (studio_session_id, updated_at DESC);

-- studio_brief
CREATE TABLE IF NOT EXISTS studio_brief (
  id                TEXT PRIMARY KEY,
  studio_session_id TEXT NOT NULL UNIQUE REFERENCES studio_session(id) ON DELETE CASCADE,
  objective         TEXT,
  users             TEXT,
  core_flow         TEXT,
  style_direction   TEXT,
  integrations      TEXT,
  assumptions       TEXT,
  constraints       TEXT,
  platform          TEXT,
  primary_user      TEXT,
  answers_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_studio_brief_session ON studio_brief (studio_session_id);

-- studio_version
CREATE TABLE IF NOT EXISTS studio_version (
  id                TEXT PRIMARY KEY,
  studio_session_id TEXT NOT NULL REFERENCES studio_session(id) ON DELETE CASCADE,
  version_number    INTEGER NOT NULL,
  preview_url       TEXT NOT NULL,
  v0_chat_id        TEXT NOT NULL,
  change_summary    TEXT,
  source            TEXT NOT NULL DEFAULT 'initial',
  created_at        TIMESTAMPTZ NOT NULL,

  CONSTRAINT studio_version_source_check CHECK (source IN ('initial', 'correction', 'agent_override')),
  CONSTRAINT studio_version_session_version_key UNIQUE (studio_session_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_studio_version_session ON studio_version (studio_session_id, version_number DESC);

-- proposal_request
CREATE TABLE IF NOT EXISTS proposal_request (
  id                TEXT PRIMARY KEY,
  studio_session_id TEXT NOT NULL REFERENCES studio_session(id) ON DELETE CASCADE,
  version_number    INTEGER NOT NULL DEFAULT 1,
  public_token      TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'pending_review',
  case_classification TEXT NOT NULL DEFAULT 'normal',
  review_required   BOOLEAN NOT NULL DEFAULT TRUE,
  reviewer_id       TEXT,
  draft_content     TEXT,
  delivery_channel  TEXT NOT NULL DEFAULT 'email',
  delivery_status   TEXT NOT NULL DEFAULT 'pending_review',
  delivery_recipient TEXT,
  approved_amount_usd NUMERIC(10,2),
  approved_currency TEXT,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_paid_at TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  first_opened_at   TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  review_notified_at TIMESTAMPTZ NOT NULL,
  review_reminded_at TIMESTAMPTZ,
  review_escalated_at TIMESTAMPTZ,
  auto_send_due_at   TIMESTAMPTZ,
  supersedes_proposal_request_id TEXT REFERENCES proposal_request(id) ON DELETE SET NULL,
  superseded_by_proposal_request_id TEXT REFERENCES proposal_request(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL,

  CONSTRAINT proposal_request_status_check CHECK (status IN (
    'pending_review', 'under_review', 'approved', 'sent',
    'payment_pending', 'payment_under_verification', 'paid',
    'expired', 'returned', 'escalated'
  )),
  CONSTRAINT proposal_request_version_positive_check CHECK (version_number > 0),
  CONSTRAINT proposal_request_case_classification_check CHECK (case_classification IN ('normal', 'special')),
  CONSTRAINT proposal_request_delivery_channel_check CHECK (delivery_channel IN ('email')),
  CONSTRAINT proposal_request_delivery_status_check CHECK (delivery_status IN ('pending_review', 'sent', 'opened'))
);

CREATE INDEX IF NOT EXISTS idx_proposal_request_session ON proposal_request (studio_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposal_request_status ON proposal_request (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_request_public_token ON proposal_request (public_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_request_session_version ON proposal_request (studio_session_id, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_request_active_per_session
  ON proposal_request (studio_session_id)
  WHERE status IN (
    'pending_review',
    'under_review',
    'approved',
    'payment_pending',
    'payment_under_verification',
    'escalated'
  );

-- proposal_review_event
CREATE TABLE IF NOT EXISTS proposal_review_event (
  id                  TEXT PRIMARY KEY,
  proposal_request_id TEXT NOT NULL REFERENCES proposal_request(id) ON DELETE CASCADE,
  action              TEXT NOT NULL,
  actor               TEXT NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL,

  CONSTRAINT proposal_review_event_action_check CHECK (action IN (
    'created',
    'approve_and_send',
    'edit',
    'create_new_version',
    'return_to_draft',
    'escalate',
    'reviewed',
    'approved',
    'sent',
    'edited',
    'returned',
    'sla_reminder',
    'sla_escalated',
    'sla_auto_sent',
    'sla_blocked_special',
    'sla_blocked_delivery',
    'delivery_failed',
    'opened',
    'new_version_created'
  ))
);

CREATE INDEX IF NOT EXISTS idx_proposal_review_event_request ON proposal_review_event (proposal_request_id, created_at ASC);

-- client_workspace
CREATE TABLE IF NOT EXISTS client_workspace (
  id                    TEXT PRIMARY KEY,
  studio_session_id     TEXT NOT NULL UNIQUE REFERENCES studio_session(id) ON DELETE CASCADE,
  payment_status        TEXT NOT NULL DEFAULT 'pending',
  workspace_status      TEXT NOT NULL DEFAULT 'active',
  latest_update_summary TEXT,
  created_at            TIMESTAMPTZ NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL,

  CONSTRAINT client_workspace_payment_status_check CHECK (payment_status IN (
    'pending', 'confirmed', 'failed', 'refunded'
  )),
  CONSTRAINT client_workspace_status_check CHECK (workspace_status IN (
    'active', 'in_preparation', 'in_development', 'in_review', 'delivered'
  )),
  CONSTRAINT client_workspace_confirmed_activation_check CHECK (
    NOT (workspace_status = 'active' AND payment_status <> 'confirmed')
  )
);

CREATE INDEX IF NOT EXISTS idx_client_workspace_updated_at ON client_workspace (updated_at DESC);

-- workspace_update
CREATE TABLE IF NOT EXISTS workspace_update (
  id                  TEXT PRIMARY KEY,
  client_workspace_id TEXT NOT NULL REFERENCES client_workspace(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  content             TEXT,
  update_type         TEXT NOT NULL DEFAULT 'status_update',
  material_url        TEXT,
  is_client_visible   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL,

  CONSTRAINT workspace_update_type_check CHECK (update_type IN (
    'status_update', 'milestone', 'material', 'note'
  ))
);

CREATE INDEX IF NOT EXISTS idx_workspace_update_workspace ON workspace_update (client_workspace_id, created_at DESC);

-- payment_event
CREATE TABLE IF NOT EXISTS payment_event (
  id                TEXT PRIMARY KEY,
  studio_session_id TEXT NOT NULL REFERENCES studio_session(id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL,
  amount_usd        NUMERIC(10,2),
  reference         TEXT,
  notes             TEXT,
  provider          TEXT,
  provider_event_id TEXT,
  provider_session_id TEXT,
  provider_payment_intent_id TEXT,
  currency          TEXT,
  payload_json      JSONB,
  created_by        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL,

  CONSTRAINT payment_event_type_check CHECK (event_type IN (
    'initiated', 'received', 'confirmed', 'failed', 'refund_initiated', 'refunded'
  ))
);

CREATE INDEX IF NOT EXISTS idx_payment_event_session ON payment_event (studio_session_id, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_event_provider_event
  ON payment_event (provider_event_id)
  WHERE provider_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_event_provider_session_confirmed
  ON payment_event (provider_session_id)
  WHERE provider_session_id IS NOT NULL AND event_type = 'confirmed';

-- studio_event
CREATE TABLE IF NOT EXISTS studio_event (
  id                TEXT PRIMARY KEY,
  studio_session_id TEXT NOT NULL REFERENCES studio_session(id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL,
  from_status       TEXT,
  to_status         TEXT,
  actor             TEXT,
  payload_json      JSONB,
  created_at        TIMESTAMPTZ NOT NULL,

  CONSTRAINT studio_event_type_check CHECK (event_type IN (
    'session_created',
    'status_transition',
    'brief_updated',
    'system_recovery',
    'message_regenerated',
    'proposal_requested',
    'proposal_reviewed',
    'payment_recorded',
    'workspace_updated'
  ))
);

CREATE INDEX IF NOT EXISTS idx_studio_event_session ON studio_event (studio_session_id, created_at DESC);

-- ============================================================================
-- Maxwell-owned tables are backend-only. The app talks to PostgreSQL from the
-- server via DATABASE_URL instead of exposing these tables through Supabase's
-- anon/authenticated API roles.
-- Explicitly excludes prototypes, conversations, and messages.
-- ============================================================================

ALTER TABLE IF EXISTS contact_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS maxwell_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS studio_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS studio_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS studio_message_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS studio_brief ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS studio_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS proposal_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS proposal_review_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS client_workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspace_update ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS studio_event ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE contact_leads FROM anon, authenticated;
REVOKE ALL ON TABLE maxwell_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE studio_session FROM anon, authenticated;
REVOKE ALL ON TABLE studio_message FROM anon, authenticated;
REVOKE ALL ON TABLE studio_message_feedback FROM anon, authenticated;
REVOKE ALL ON TABLE studio_brief FROM anon, authenticated;
REVOKE ALL ON TABLE studio_version FROM anon, authenticated;
REVOKE ALL ON TABLE proposal_request FROM anon, authenticated;
REVOKE ALL ON TABLE proposal_review_event FROM anon, authenticated;
REVOKE ALL ON TABLE client_workspace FROM anon, authenticated;
REVOKE ALL ON TABLE workspace_update FROM anon, authenticated;
REVOKE ALL ON TABLE payment_event FROM anon, authenticated;
REVOKE ALL ON TABLE studio_event FROM anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE contact_leads TO service_role;
GRANT ALL PRIVILEGES ON TABLE maxwell_sessions TO service_role;
GRANT ALL PRIVILEGES ON TABLE studio_session TO service_role;
GRANT ALL PRIVILEGES ON TABLE studio_message TO service_role;
GRANT ALL PRIVILEGES ON TABLE studio_message_feedback TO service_role;
GRANT ALL PRIVILEGES ON TABLE studio_brief TO service_role;
GRANT ALL PRIVILEGES ON TABLE studio_version TO service_role;
GRANT ALL PRIVILEGES ON TABLE proposal_request TO service_role;
GRANT ALL PRIVILEGES ON TABLE proposal_review_event TO service_role;
GRANT ALL PRIVILEGES ON TABLE client_workspace TO service_role;
GRANT ALL PRIVILEGES ON TABLE workspace_update TO service_role;
GRANT ALL PRIVILEGES ON TABLE payment_event TO service_role;
GRANT ALL PRIVILEGES ON TABLE studio_event TO service_role;

-- website_upgrade tables (see migrations/20260412_008_website_upgrade.sql)
ALTER TABLE IF EXISTS website_upgrade_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS website_upgrade_page    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS website_upgrade_audit   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS website_upgrade_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS website_upgrade_event   ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE website_upgrade_session FROM anon, authenticated;
REVOKE ALL ON TABLE website_upgrade_page    FROM anon, authenticated;
REVOKE ALL ON TABLE website_upgrade_audit   FROM anon, authenticated;
REVOKE ALL ON TABLE website_upgrade_version FROM anon, authenticated;
REVOKE ALL ON TABLE website_upgrade_event   FROM anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE website_upgrade_session TO service_role;
GRANT ALL PRIVILEGES ON TABLE website_upgrade_page    TO service_role;
GRANT ALL PRIVILEGES ON TABLE website_upgrade_audit   TO service_role;
GRANT ALL PRIVILEGES ON TABLE website_upgrade_version TO service_role;
GRANT ALL PRIVILEGES ON TABLE website_upgrade_event   TO service_role;
