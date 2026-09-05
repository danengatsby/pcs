CREATE TABLE IF NOT EXISTS arbitration_cases (
  id BIGSERIAL PRIMARY KEY,
  case_number VARCHAR(80) NOT NULL UNIQUE,
  organization_id VARCHAR(80) REFERENCES organizations(id) ON DELETE RESTRICT,
  case_type VARCHAR(30) NOT NULL CHECK (case_type IN ('disciplinary', 'member_dispute', 'competence', 'election', 'other')),
  subject VARCHAR(180) NOT NULL,
  facts TEXT NOT NULL,
  legal_basis TEXT NOT NULL DEFAULT '',
  status VARCHAR(24) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'response_due', 'hearing', 'decided', 'appealed', 'closed', 'dismissed')),
  filed_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  filed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_due_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arbitration_cases_scope_status
  ON arbitration_cases (organization_id, status, filed_at DESC);

CREATE TABLE IF NOT EXISTS arbitration_parties (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES arbitration_cases(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  full_name VARCHAR(160) NOT NULL,
  party_role VARCHAR(20) NOT NULL CHECK (party_role IN ('claimant', 'respondent', 'witness')),
  notified_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, user_id, party_role)
);

CREATE TABLE IF NOT EXISTS arbitration_evidence (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES arbitration_cases(id) ON DELETE CASCADE,
  submitted_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(180) NOT NULL,
  document_path VARCHAR(320) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arbitration_conflicts (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES arbitration_cases(id) ON DELETE CASCADE,
  arbitrator_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'declared' CHECK (status IN ('declared', 'accepted', 'rejected', 'resolved')),
  declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (case_id, arbitrator_user_id)
);

CREATE TABLE IF NOT EXISTS arbitration_decisions (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES arbitration_cases(id) ON DELETE CASCADE,
  decided_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  outcome VARCHAR(24) NOT NULL CHECK (outcome IN ('upheld', 'rejected', 'partially_upheld', 'dismissed')),
  reasoning TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arbitration_appeals (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES arbitration_cases(id) ON DELETE CASCADE,
  appealed_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  grounds TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'admissible', 'decided', 'rejected')),
  filed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_arbitration_appeals_case_status
  ON arbitration_appeals (case_id, status, filed_at DESC);

CREATE OR REPLACE FUNCTION prevent_arbitrator_conflict()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM arbitration_parties
    WHERE case_id = NEW.case_id AND user_id = NEW.arbitrator_user_id
  ) THEN
    RAISE EXCEPTION 'Arbitrul este parte sau martor în acest dosar.'
      USING ERRCODE = '23514', CONSTRAINT = 'arbitration_arbitrator_no_party_conflict';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS arbitration_conflict_party_guard ON arbitration_conflicts;
CREATE TRIGGER arbitration_conflict_party_guard
  BEFORE INSERT OR UPDATE OF case_id, arbitrator_user_id ON arbitration_conflicts
  FOR EACH ROW EXECUTE FUNCTION prevent_arbitrator_conflict();