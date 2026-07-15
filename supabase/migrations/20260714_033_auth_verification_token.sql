-- Email magic-link sign-in (Auth.js v5 email provider, @auth/core 0.41.0).
--
-- Auth.js's email/magic-link providers REQUIRE an adapter to persist
-- verification tokens — even under `session.strategy: "jwt"` (JWT only affects
-- sessions, not the token-verification handshake). This repo has no Auth.js
-- schema and identifies users purely by email string (studio_session.owner_email),
-- so we add ONLY the verification-token table and keep users "virtual"
-- (identity = email) via a minimal custom adapter (lib/auth/verification-adapter.ts).
--
-- Security: `token` is `sha256(rawToken + AUTH_SECRET)` hex — @auth/core hashes
-- the token BEFORE handing it to the adapter (send-token.js), so the raw 32-char
-- link value is NEVER stored. A DB leak exposes no usable links. Single-use is
-- enforced by an atomic DELETE ... RETURNING in the adapter.
--
-- Reversible via `DROP TABLE public.auth_verification_token`.

BEGIN;

CREATE TABLE IF NOT EXISTS auth_verification_token (
  identifier  TEXT        NOT NULL,  -- normalized (lowercased) email
  token       TEXT        NOT NULL,  -- sha256 hex (64 chars) — never the raw token
  expires     TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT auth_verification_token_pkey PRIMARY KEY (identifier, token)
);

-- Reaper sweep ("delete expired") without a full scan.
CREATE INDEX IF NOT EXISTS idx_auth_verification_token_expires
  ON auth_verification_token (expires);

ALTER TABLE IF EXISTS auth_verification_token ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE auth_verification_token FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE auth_verification_token TO service_role;

INSERT INTO public.schema_migrations (filename, applied_at, checksum, applied_by) VALUES
  ('20260714_033_auth_verification_token.sql', now(), NULL, 'migration:self-register')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
