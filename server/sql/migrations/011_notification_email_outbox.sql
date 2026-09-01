CREATE TABLE IF NOT EXISTS notification_email_outbox (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(120) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'retry', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 6
    CHECK (max_attempts >= 1),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT NOT NULL DEFAULT '',
  locked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_notification_email_outbox_dispatch
  ON notification_email_outbox (next_attempt_at ASC, id ASC)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_notification_email_outbox_status_created_at
  ON notification_email_outbox (status, created_at DESC);
