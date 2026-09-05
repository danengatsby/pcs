-- Dates are explicit operational metadata, never inferred from a document's age.
ALTER TABLE member_documents ADD COLUMN IF NOT EXISTS expires_on DATE;
ALTER TABLE organization_mandate_decisions ADD COLUMN IF NOT EXISTS expires_on DATE;
ALTER TABLE congress_decisions ADD COLUMN IF NOT EXISTS expires_on DATE;
ALTER TABLE arbitration_decisions ADD COLUMN IF NOT EXISTS expires_on DATE;

CREATE INDEX IF NOT EXISTS idx_member_documents_expiration ON member_documents (expires_on) WHERE expires_on IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mandate_decisions_expiration ON organization_mandate_decisions (expires_on) WHERE expires_on IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_congress_decisions_expiration ON congress_decisions (expires_on) WHERE expires_on IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_arbitration_decisions_expiration ON arbitration_decisions (expires_on) WHERE expires_on IS NOT NULL;
