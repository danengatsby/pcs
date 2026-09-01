ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS owner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ;

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS contact_channel VARCHAR(30);

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS crm_priority VARCHAR(20) NOT NULL DEFAULT 'medie';

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS crm_tags JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_volunteers_contact_channel'
  ) THEN
    ALTER TABLE volunteers
    ADD CONSTRAINT chk_volunteers_contact_channel
    CHECK (
      contact_channel IS NULL
      OR contact_channel IN (
        'telefon',
        'email',
        'whatsapp',
        'telegram',
        'facebook',
        'intalnire',
        'altul'
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_volunteers_crm_priority'
  ) THEN
    ALTER TABLE volunteers
    ADD CONSTRAINT chk_volunteers_crm_priority
    CHECK (crm_priority IN ('scazuta', 'medie', 'ridicata', 'critica'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_volunteers_crm_tags_array'
  ) THEN
    ALTER TABLE volunteers
    ADD CONSTRAINT chk_volunteers_crm_tags_array
    CHECK (jsonb_typeof(crm_tags) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_volunteers_owner_user_id
  ON volunteers (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_volunteers_follow_up_at
  ON volunteers (follow_up_at)
  WHERE follow_up_at IS NOT NULL;
