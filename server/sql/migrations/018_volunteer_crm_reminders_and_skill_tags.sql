ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ;

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS skill_tags JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_volunteers_skill_tags_array'
  ) THEN
    ALTER TABLE volunteers
    ADD CONSTRAINT chk_volunteers_skill_tags_array
    CHECK (jsonb_typeof(skill_tags) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_volunteers_reminder_at
  ON volunteers (reminder_at)
  WHERE reminder_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_volunteers_skill_tags_gin
  ON volunteers
  USING GIN (skill_tags);
