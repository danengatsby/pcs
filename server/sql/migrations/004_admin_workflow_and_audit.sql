ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(20) NOT NULL DEFAULT 'nou';

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS internal_notes TEXT NOT NULL DEFAULT '';

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS status_updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_volunteers_workflow_status'
  ) THEN
    ALTER TABLE volunteers
    ADD CONSTRAINT chk_volunteers_workflow_status
    CHECK (workflow_status IN ('nou', 'validat', 'contactat', 'activ'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_volunteers_workflow_status ON volunteers (workflow_status, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  actor_email VARCHAR(180) NOT NULL DEFAULT '',
  actor_role VARCHAR(20) NOT NULL DEFAULT '',
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(80) NOT NULL,
  target_id VARCHAR(120) NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_created_at ON admin_audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_user_id ON admin_audit_log (actor_user_id);
