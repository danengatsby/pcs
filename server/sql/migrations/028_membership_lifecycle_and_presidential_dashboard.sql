-- Flux de apartenență guvernat explicit:
-- susținător -> cerere -> verificat -> aprobat -> membru activ.
-- Stările suspendat/încetat rămân disponibile după activare.

CREATE SEQUENCE IF NOT EXISTS membership_number_seq START WITH 1;

ALTER TABLE membership_records
  ADD COLUMN IF NOT EXISTS member_number VARCHAR(32),
  ADD COLUMN IF NOT EXISTS application_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_organization_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS approval_body VARCHAR(180) NOT NULL DEFAULT '';

ALTER TABLE membership_records
  DROP CONSTRAINT IF EXISTS chk_membership_records_status;

ALTER TABLE membership_events
  DROP CONSTRAINT IF EXISTS chk_membership_events_action,
  DROP CONSTRAINT IF EXISTS chk_membership_events_previous_status,
  DROP CONSTRAINT IF EXISTS chk_membership_events_next_status;

UPDATE membership_records
SET
  status = CASE
    WHEN status = 'pending' THEN 'application'
    WHEN status = 'adherent' THEN 'approved'
    ELSE status
  END,
  application_at = COALESCE(application_at, created_at),
  approved_at = CASE
    WHEN status IN ('adherent', 'active', 'suspended', 'terminated')
      THEN COALESCE(approved_at, validated_at, joined_at, updated_at)
    ELSE approved_at
  END,
  approval_organization_id = CASE
    WHEN status IN ('adherent', 'active', 'suspended', 'terminated')
      THEN COALESCE(approval_organization_id, organization_id)
    ELSE approval_organization_id
  END,
  approval_body = CASE
    WHEN status IN ('adherent', 'active', 'suspended', 'terminated')
      THEN COALESCE(NULLIF(approval_body, ''), 'Conducerea PCS — evidență migrată')
    ELSE approval_body
  END;

UPDATE membership_events
SET
  action = CASE
    WHEN action = 'validate' THEN 'approve'
    WHEN action = 'promote' THEN 'activate'
    ELSE action
  END,
  previous_status = CASE
    WHEN previous_status = 'pending' THEN 'application'
    WHEN previous_status = 'adherent' THEN 'approved'
    ELSE previous_status
  END,
  next_status = CASE
    WHEN next_status = 'pending' THEN 'application'
    WHEN next_status = 'adherent' THEN 'approved'
    ELSE next_status
  END;

UPDATE membership_records
SET member_number = 'PCS-'
  || EXTRACT(YEAR FROM COALESCE(joined_at, approved_at, updated_at))::INTEGER::TEXT
  || '-'
  || LPAD(nextval('membership_number_seq')::TEXT, 6, '0')
WHERE member_number IS NULL
  AND status IN ('active', 'suspended', 'terminated')
  AND joined_at IS NOT NULL;

ALTER TABLE membership_records
  ALTER COLUMN status SET DEFAULT 'application',
  ALTER COLUMN application_at SET DEFAULT NOW(),
  ALTER COLUMN application_at SET NOT NULL;

ALTER TABLE membership_records
  DROP CONSTRAINT IF EXISTS chk_membership_records_status;

ALTER TABLE membership_records
  ADD CONSTRAINT chk_membership_records_status CHECK (
    status IN ('supporter', 'application', 'verified', 'approved', 'active', 'suspended', 'terminated')
  );

ALTER TABLE membership_events
  DROP CONSTRAINT IF EXISTS chk_membership_events_action,
  DROP CONSTRAINT IF EXISTS chk_membership_events_previous_status,
  DROP CONSTRAINT IF EXISTS chk_membership_events_next_status;

ALTER TABLE membership_events
  ADD CONSTRAINT chk_membership_events_action CHECK (
    action IN ('import', 'submit', 'verify', 'approve', 'activate', 'suspend', 'reactivate', 'transfer', 'terminate')
  ),
  ADD CONSTRAINT chk_membership_events_previous_status CHECK (
    previous_status IS NULL
    OR previous_status IN ('supporter', 'application', 'verified', 'approved', 'active', 'suspended', 'terminated')
  ),
  ADD CONSTRAINT chk_membership_events_next_status CHECK (
    next_status IN ('supporter', 'application', 'verified', 'approved', 'active', 'suspended', 'terminated')
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_membership_approval_organization') THEN
    ALTER TABLE membership_records
      ADD CONSTRAINT fk_membership_approval_organization
      FOREIGN KEY (approval_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_records_member_number_unique
  ON membership_records (member_number);

CREATE INDEX IF NOT EXISTS idx_membership_records_application_at
  ON membership_records (application_at DESC);

CREATE INDEX IF NOT EXISTS idx_membership_records_approval_organization
  ON membership_records (approval_organization_id, approved_at DESC);
