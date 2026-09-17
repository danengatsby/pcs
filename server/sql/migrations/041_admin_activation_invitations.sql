CREATE TABLE IF NOT EXISTS admin_activation_invitations (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  credential_id UUID NOT NULL REFERENCES admin_mfa_credentials(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_activation_invitations_expiry_idx ON admin_activation_invitations(expires_at);
