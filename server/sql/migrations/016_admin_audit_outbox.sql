CREATE TABLE IF NOT EXISTS admin_audit_outbox (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(120) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 6,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT NOT NULL DEFAULT '',
  locked_at TIMESTAMPTZ NULL,
  sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_outbox_status_next_attempt
  ON admin_audit_outbox (status, next_attempt_at, id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_outbox_locked_at
  ON admin_audit_outbox (locked_at);
