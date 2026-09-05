-- Registrul de guvernanta interna: congrese, delegati, candidaturi si voturi anonimizate.

CREATE TABLE IF NOT EXISTS congresses (
  id BIGSERIAL PRIMARY KEY,
  organization_id VARCHAR(80) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  title VARCHAR(180) NOT NULL,
  purpose VARCHAR(40) NOT NULL CHECK (purpose IN ('ordinary', 'extraordinary', 'founding')),
  status VARCHAR(24) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closed', 'validated', 'cancelled')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  quorum INTEGER NOT NULL CHECK (quorum > 0),
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  CHECK (closed_at IS NULL OR closed_at >= starts_at),
  CHECK (validated_at IS NULL OR closed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_congresses_organization_status
  ON congresses (organization_id, status, starts_at DESC);

CREATE TABLE IF NOT EXISTS congress_delegates (
  id BIGSERIAL PRIMARY KEY,
  congress_id BIGINT NOT NULL REFERENCES congresses(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  full_name VARCHAR(160) NOT NULL,
  organization_id VARCHAR(80) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  selected_by VARCHAR(180) NOT NULL DEFAULT '',
  eligibility_status VARCHAR(20) NOT NULL DEFAULT 'eligible'
    CHECK (eligibility_status IN ('eligible', 'revoked', 'replaced')),
  checked_in_at TIMESTAMPTZ,
  voted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (congress_id, user_id),
  UNIQUE (congress_id, full_name, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_congress_delegates_congress_status
  ON congress_delegates (congress_id, eligibility_status);

CREATE TABLE IF NOT EXISTS congress_candidacies (
  id BIGSERIAL PRIMARY KEY,
  congress_id BIGINT NOT NULL REFERENCES congresses(id) ON DELETE CASCADE,
  candidate_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  candidate_name VARCHAR(160) NOT NULL,
  office VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'validated', 'withdrawn', 'elected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (congress_id, candidate_name, office)
);

CREATE INDEX IF NOT EXISTS idx_congress_candidacies_congress_office
  ON congress_candidacies (congress_id, office, status);

CREATE TABLE IF NOT EXISTS congress_votes (
  id BIGSERIAL PRIMARY KEY,
  congress_id BIGINT NOT NULL REFERENCES congresses(id) ON DELETE CASCADE,
  candidacy_id BIGINT NOT NULL REFERENCES congress_candidacies(id) ON DELETE RESTRICT,
  office VARCHAR(120) NOT NULL,
  choice VARCHAR(20) NOT NULL CHECK (choice IN ('yes', 'no', 'abstain')),
  ballot_hash CHAR(64) NOT NULL UNIQUE,
  cast_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_congress_votes_results
  ON congress_votes (congress_id, office, candidacy_id, choice);

CREATE TABLE IF NOT EXISTS congress_decisions (
  id BIGSERIAL PRIMARY KEY,
  congress_id BIGINT NOT NULL REFERENCES congresses(id) ON DELETE CASCADE,
  decision_type VARCHAR(40) NOT NULL CHECK (decision_type IN ('quorum', 'result', 'minutes', 'validation')),
  decision_text TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_congress_decisions_congress
  ON congress_decisions (congress_id, created_at DESC);