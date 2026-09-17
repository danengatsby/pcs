CREATE TABLE IF NOT EXISTS admin_mfa_credentials (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  id UUID NOT NULL UNIQUE,
  encrypted_secret TEXT NOT NULL,
  last_step BIGINT NOT NULL DEFAULT -1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  enabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_auth_sessions (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id UUID NOT NULL REFERENCES admin_mfa_credentials(id) ON DELETE CASCADE,
  refresh_token_hash CHAR(64) UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_auth_sessions_user_idx ON admin_auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS admin_auth_sessions_expiry_idx ON admin_auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS admin_access_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile VARCHAR(30) NOT NULL CHECK (profile IN ('leadership', 'secretariat', 'communications', 'treasury', 'parliamentary', 'arbitration')),
  assigned_by VARCHAR(180) NOT NULL,
  reason TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
