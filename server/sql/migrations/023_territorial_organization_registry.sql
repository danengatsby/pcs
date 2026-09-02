-- Înlocuiește organizația demonstrativă cu un registru teritorial administrabil.
-- Nu sunt inventate filiale: seed-ul neatins este eliminat, iar structurile reale
-- vor fi introduse de conducere împreună cu documentele și datele lor reale.

DELETE FROM organizations
WHERE id = 'org-national-pcs'
  AND name = 'PCS Organizația Națională'
  AND county = 'București'
  AND members_count = 0
  AND status = 'active'
  AND updated_at <= created_at + INTERVAL '1 second';

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS parent_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS official_email VARCHAR(180) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS headquarters VARCHAR(260) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS founded_at DATE,
  ADD COLUMN IF NOT EXISTS created_by BIGINT,
  ADD COLUMN IF NOT EXISTS updated_by BIGINT;

UPDATE organizations
SET code = UPPER(LEFT('LEGACY-' || id, 80))
WHERE code IS NULL OR BTRIM(code) = '';

ALTER TABLE organizations
  ALTER COLUMN code SET NOT NULL;

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS chk_organizations_status;

ALTER TABLE organizations
  ADD CONSTRAINT chk_organizations_status
  CHECK (status IN ('forming', 'active', 'inactive', 'dissolved'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_organizations_parent_id') THEN
    ALTER TABLE organizations
      ADD CONSTRAINT fk_organizations_parent_id
      FOREIGN KEY (parent_id) REFERENCES organizations(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_organizations_created_by') THEN
    ALTER TABLE organizations
      ADD CONSTRAINT fk_organizations_created_by
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_organizations_updated_by') THEN
    ALTER TABLE organizations
      ADD CONSTRAINT fk_organizations_updated_by
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_code_unique
  ON organizations (LOWER(code));

CREATE INDEX IF NOT EXISTS idx_organizations_parent_id
  ON organizations (parent_id);

CREATE TABLE IF NOT EXISTS organization_territories (
  id BIGSERIAL PRIMARY KEY,
  organization_id VARCHAR(80) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  territory_type VARCHAR(20) NOT NULL,
  county_id INTEGER REFERENCES counties(id) ON DELETE RESTRICT,
  locality VARCHAR(160) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_organization_territory_type
    CHECK (territory_type IN ('national', 'county', 'locality')),
  CONSTRAINT chk_organization_territory_shape CHECK (
    (territory_type = 'national' AND county_id IS NULL AND BTRIM(locality) = '')
    OR (territory_type = 'county' AND county_id IS NOT NULL AND BTRIM(locality) = '')
    OR (territory_type = 'locality' AND county_id IS NOT NULL AND BTRIM(locality) <> '')
  )
);

CREATE INDEX IF NOT EXISTS idx_organization_territories_organization
  ON organization_territories (organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_territories_county
  ON organization_territories (county_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_territories_unique
  ON organization_territories (
    organization_id,
    territory_type,
    COALESCE(county_id, 0),
    LOWER(locality)
  );

INSERT INTO organization_territories (organization_id, territory_type, county_id, locality)
SELECT
  o.id,
  CASE
    WHEN o.level = 'national' THEN 'national'
    WHEN o.level = 'county' THEN 'county'
    ELSE 'locality'
  END,
  CASE WHEN o.level = 'national' THEN NULL ELSE c.id END,
  CASE WHEN o.level = 'local' THEN o.name ELSE '' END
FROM organizations o
LEFT JOIN counties c ON c.normalized_name = normalize_county_text(o.county)
WHERE
  o.level = 'national'
  OR c.id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS organization_leadership_mandates (
  id BIGSERIAL PRIMARY KEY,
  organization_id VARCHAR(80) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  full_name VARCHAR(160) NOT NULL,
  position_title VARCHAR(120) NOT NULL,
  started_at DATE NOT NULL,
  ended_at DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_organization_mandate_status
    CHECK (status IN ('planned', 'active', 'completed', 'suspended')),
  CONSTRAINT chk_organization_mandate_dates
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_organization_mandates_org_status
  ON organization_leadership_mandates (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_organization_mandates_user
  ON organization_leadership_mandates (user_id);

CREATE TABLE IF NOT EXISTS organization_objectives (
  id BIGSERIAL PRIMARY KEY,
  organization_id VARCHAR(80) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  metric_name VARCHAR(120) NOT NULL DEFAULT '',
  target_value NUMERIC(14, 2) NOT NULL,
  current_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(40) NOT NULL DEFAULT 'număr',
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_organization_objective_status
    CHECK (status IN ('planned', 'in_progress', 'achieved', 'at_risk', 'cancelled')),
  CONSTRAINT chk_organization_objective_values
    CHECK (target_value >= 0 AND current_value >= 0)
);

CREATE INDEX IF NOT EXISTS idx_organization_objectives_org_status
  ON organization_objectives (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_organization_objectives_due_date
  ON organization_objectives (due_date);
