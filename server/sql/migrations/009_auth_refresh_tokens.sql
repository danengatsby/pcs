CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  rotated_from_id BIGINT REFERENCES auth_refresh_tokens(id) ON DELETE SET NULL,
  rotated_to_id BIGINT REFERENCES auth_refresh_tokens(id) ON DELETE SET NULL,
  user_agent VARCHAR(255) NOT NULL DEFAULT '',
  ip_address VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id
  ON auth_refresh_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires_at
  ON auth_refresh_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_revoked_at
  ON auth_refresh_tokens (revoked_at);
