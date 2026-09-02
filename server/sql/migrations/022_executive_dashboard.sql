CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(80) PRIMARY KEY,
  level VARCHAR(20) NOT NULL,
  name VARCHAR(180) NOT NULL,
  county VARCHAR(120) NOT NULL DEFAULT '',
  members_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_organizations_level CHECK (level IN ('national', 'county', 'local')),
  CONSTRAINT chk_organizations_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT chk_organizations_members_count CHECK (members_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_organizations_status_level
  ON organizations(status, level);

CREATE INDEX IF NOT EXISTS idx_organizations_county
  ON organizations(county);

INSERT INTO organizations (
  id,
  level,
  name,
  county,
  members_count,
  status
)
VALUES (
  'org-national-pcs',
  'national',
  'PCS Organizația Națională',
  'București',
  0,
  'active'
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS executive_targets (
  key VARCHAR(60) PRIMARY KEY,
  label VARCHAR(160) NOT NULL,
  target_value NUMERIC(12, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  direction VARCHAR(20) NOT NULL,
  updated_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_executive_targets_key CHECK (
    key IN (
      'contact_rate',
      'member_conversion_rate',
      'overdue_cases',
      'active_organizations'
    )
  ),
  CONSTRAINT chk_executive_targets_value CHECK (target_value >= 0),
  CONSTRAINT chk_executive_targets_unit CHECK (unit IN ('percent', 'count')),
  CONSTRAINT chk_executive_targets_direction CHECK (direction IN ('at_least', 'at_most'))
);

INSERT INTO executive_targets (key, label, target_value, unit, direction)
VALUES
  ('contact_rate', 'Rată de contactare', 80, 'percent', 'at_least'),
  ('member_conversion_rate', 'Conversie în membri', 25, 'percent', 'at_least'),
  ('overdue_cases', 'Dosare restante', 0, 'count', 'at_most'),
  ('active_organizations', 'Organizații active', 10, 'count', 'at_least')
ON CONFLICT (key) DO NOTHING;
