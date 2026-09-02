ALTER TABLE notification_email_outbox
  ADD COLUMN IF NOT EXISTS event_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS delivery_unknown_at TIMESTAMPTZ;

UPDATE notification_email_outbox
SET event_id = 'legacy-' || id::TEXT
WHERE event_id IS NULL;

ALTER TABLE notification_email_outbox
  ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE notification_email_outbox
  DROP CONSTRAINT IF EXISTS notification_email_outbox_status_check;

ALTER TABLE notification_email_outbox
  ADD CONSTRAINT notification_email_outbox_status_check
  CHECK (status IN ('pending', 'processing', 'retry', 'delivery_unknown', 'sent', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_email_outbox_event_id
  ON notification_email_outbox (event_id);

CREATE INDEX IF NOT EXISTS idx_notification_email_outbox_delivery_unknown
  ON notification_email_outbox (next_attempt_at ASC, id ASC)
  WHERE status = 'delivery_unknown';
