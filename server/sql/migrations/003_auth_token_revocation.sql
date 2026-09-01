CREATE TABLE IF NOT EXISTS auth_revoked_tokens (
  jti VARCHAR(120) PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_revoked_tokens_expires_at
  ON auth_revoked_tokens (expires_at);
