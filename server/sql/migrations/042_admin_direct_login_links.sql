CREATE TABLE IF NOT EXISTS admin_direct_login_links (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  credential_id UUID NOT NULL REFERENCES admin_mfa_credentials(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  auth_state_hash CHAR(64) NOT NULL,
  issued_by VARCHAR(180) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_direct_login_links_expiry_idx ON admin_direct_login_links(expires_at);
