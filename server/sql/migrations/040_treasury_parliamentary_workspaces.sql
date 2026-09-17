CREATE TABLE IF NOT EXISTS treasury_entries (
  id UUID PRIMARY KEY,
  request_hash CHAR(64) NOT NULL,
  organization_id VARCHAR(80) REFERENCES organizations(id) ON DELETE RESTRICT,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('income', 'expense')),
  category VARCHAR(30) NOT NULL CHECK (category IN ('membership_fee', 'donation', 'subsidy', 'operations', 'event', 'other')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 99999999999),
  currency CHAR(3) NOT NULL DEFAULT 'RON' CHECK (currency = 'RON'),
  occurred_on DATE NOT NULL,
  description VARCHAR(500) NOT NULL,
  reference VARCHAR(180) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'voided')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  posted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  voided_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  void_reason VARCHAR(2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS treasury_entries_status_date_idx ON treasury_entries(status, occurred_on DESC);

CREATE TABLE IF NOT EXISTS parliamentary_items (
  id UUID PRIMARY KEY,
  request_hash CHAR(64) NOT NULL,
  title VARCHAR(240) NOT NULL,
  kind VARCHAR(30) NOT NULL CHECK (kind IN ('bill', 'amendment', 'question', 'committee_work')),
  chamber VARCHAR(20) NOT NULL CHECK (chamber IN ('deputies', 'senate', 'joint')),
  reference VARCHAR(100) NOT NULL DEFAULT '',
  source_url VARCHAR(2000) NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
  due_on DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'committee', 'scheduled', 'adopted', 'rejected', 'withdrawn')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS parliamentary_items_status_due_idx ON parliamentary_items(status, due_on);
