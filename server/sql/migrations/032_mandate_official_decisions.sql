CREATE TABLE IF NOT EXISTS organization_mandate_decisions (
  id BIGSERIAL PRIMARY KEY,
  organization_id VARCHAR(80) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  decision_number VARCHAR(80) NOT NULL,
  decision_date DATE NOT NULL,
  issuing_body VARCHAR(180) NOT NULL,
  minutes_path VARCHAR(320) NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, decision_number)
);

ALTER TABLE organization_leadership_mandates
  ADD COLUMN IF NOT EXISTS decision_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mandates_decision_id') THEN
    ALTER TABLE organization_leadership_mandates
      ADD CONSTRAINT fk_mandates_decision_id
      FOREIGN KEY (decision_id) REFERENCES organization_mandate_decisions(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mandates_decision_id
  ON organization_leadership_mandates (decision_id);