ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS chk_organizations_level;

ALTER TABLE organizations
  ADD CONSTRAINT chk_organizations_level
  CHECK (level IN ('national', 'county', 'municipal', 'local'));