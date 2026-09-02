-- Nucleul operațional pentru etapa 60–90 de zile:
-- evenimente, campanii, sarcini, comunicare cu consimțământ și portal de membru.

ALTER TABLE mobilization_actions
  ADD COLUMN IF NOT EXISTS organization_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS coordinator_user_id BIGINT,
  ADD COLUMN IF NOT EXISTS objective TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_metric VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_value NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS result_value NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS result_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS created_by BIGINT,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mobilization_actions_organization') THEN
    ALTER TABLE mobilization_actions
      ADD CONSTRAINT fk_mobilization_actions_organization
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mobilization_actions_coordinator') THEN
    ALTER TABLE mobilization_actions
      ADD CONSTRAINT fk_mobilization_actions_coordinator
      FOREIGN KEY (coordinator_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mobilization_actions_creator') THEN
    ALTER TABLE mobilization_actions
      ADD CONSTRAINT fk_mobilization_actions_creator
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE mobilization_actions
  DROP CONSTRAINT IF EXISTS chk_mobilization_actions_visibility;
ALTER TABLE mobilization_actions
  ADD CONSTRAINT chk_mobilization_actions_visibility
  CHECK (visibility IN ('public', 'members', 'internal'));
ALTER TABLE mobilization_actions
  DROP CONSTRAINT IF EXISTS chk_mobilization_actions_version;
ALTER TABLE mobilization_actions
  ADD CONSTRAINT chk_mobilization_actions_version CHECK (version > 0);

CREATE TABLE IF NOT EXISTS mobilization_action_counties (
  action_id BIGINT NOT NULL REFERENCES mobilization_actions(id) ON DELETE CASCADE,
  county_id INTEGER NOT NULL REFERENCES counties(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (action_id, county_id)
);

CREATE TABLE IF NOT EXISTS mobilization_participants (
  id BIGSERIAL PRIMARY KEY,
  action_id BIGINT NOT NULL REFERENCES mobilization_actions(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  membership_id BIGINT REFERENCES membership_records(id) ON DELETE SET NULL,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL,
  participation_role VARCHAR(24) NOT NULL DEFAULT 'participant'
    CHECK (participation_role IN ('participant', 'invitee', 'volunteer', 'assignee', 'coordinator')),
  status VARCHAR(24) NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'confirmed', 'declined', 'active', 'in_progress', 'reported', 'completed', 'cancelled')),
  attendance_status VARCHAR(20) NOT NULL DEFAULT 'not_applicable'
    CHECK (attendance_status IN ('not_applicable', 'pending', 'present', 'absent', 'excused')),
  due_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  report TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  hours NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (hours >= 0 AND hours <= 10000),
  invited_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  reported_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  assigned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mobilization_participants_action_email_unique
  ON mobilization_participants (action_id, LOWER(email));
CREATE INDEX IF NOT EXISTS idx_mobilization_participants_user
  ON mobilization_participants (user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mobilization_participants_membership
  ON mobilization_participants (membership_id, status, updated_at DESC);

ALTER TABLE mobilization_responses
  ADD COLUMN IF NOT EXISTS email_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_version VARCHAR(40) NOT NULL DEFAULT 'mobilizare-v1';

UPDATE mobilization_responses
SET email_consent = TRUE
WHERE updates_consent = TRUE;

CREATE TABLE IF NOT EXISTS communication_consents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  membership_id BIGINT REFERENCES membership_records(id) ON DELETE SET NULL,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  county_id INTEGER REFERENCES counties(id) ON DELETE RESTRICT,
  county VARCHAR(120) NOT NULL DEFAULT '',
  locality VARCHAR(120) NOT NULL DEFAULT '',
  interests JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(interests) = 'array'),
  email_consent BOOLEAN NOT NULL DEFAULT FALSE,
  sms_consent BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_consent BOOLEAN NOT NULL DEFAULT FALSE,
  consent_version VARCHAR(40) NOT NULL,
  source VARCHAR(80) NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  granted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_consents_email_unique
  ON communication_consents (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_communication_consents_segments
  ON communication_consents (county_id, email_consent, sms_consent, whatsapp_consent)
  WHERE withdrawn_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_communication_consents_interests
  ON communication_consents USING GIN (interests);

INSERT INTO communication_consents (
  user_id,
  membership_id,
  full_name,
  email,
  phone,
  county_id,
  county,
  locality,
  interests,
  email_consent,
  sms_consent,
  whatsapp_consent,
  consent_version,
  source,
  evidence,
  granted_at,
  created_at,
  updated_at
)
SELECT DISTINCT ON (LOWER(response.email))
  membership.user_id,
  membership.id,
  response.full_name,
  LOWER(response.email),
  response.phone,
  county.id,
  response.county,
  response.locality,
  response.interests,
  response.updates_consent OR response.email_consent,
  response.sms_consent,
  response.whatsapp_consent,
  response.consent_version,
  'mobilization_response',
  jsonb_build_object('responseId', response.id, 'migrated', TRUE),
  CASE WHEN response.updates_consent OR response.email_consent OR response.sms_consent OR response.whatsapp_consent
    THEN response.created_at ELSE NULL END,
  response.created_at,
  response.created_at
FROM mobilization_responses response
LEFT JOIN membership_records membership ON LOWER(membership.email) = LOWER(response.email)
LEFT JOIN counties county ON county.name = response.county
ORDER BY LOWER(response.email), response.created_at DESC
ON CONFLICT DO NOTHING;

INSERT INTO mobilization_participants (
  action_id,
  user_id,
  membership_id,
  full_name,
  email,
  participation_role,
  status,
  attendance_status,
  responded_at,
  created_at,
  updated_at
)
SELECT
  response.action_id,
  membership.user_id,
  membership.id,
  response.full_name,
  LOWER(response.email),
  CASE action.action_type
    WHEN 'event' THEN 'invitee'
    WHEN 'campaign' THEN 'volunteer'
    WHEN 'volunteer_task' THEN 'assignee'
    ELSE 'participant'
  END,
  CASE action.action_type
    WHEN 'campaign' THEN 'active'
    ELSE 'confirmed'
  END,
  CASE action.action_type WHEN 'event' THEN 'pending' ELSE 'not_applicable' END,
  response.created_at,
  response.created_at,
  response.created_at
FROM mobilization_responses response
JOIN mobilization_actions action ON action.id = response.action_id
LEFT JOIN membership_records membership ON LOWER(membership.email) = LOWER(response.email)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS communication_dispatches (
  id BIGSERIAL PRIMARY KEY,
  organization_id VARCHAR(80) REFERENCES organizations(id) ON DELETE SET NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  status VARCHAR(24) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'queued', 'ready_external', 'sent', 'cancelled')),
  county_ids JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(county_ids) = 'array'),
  roles JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(roles) = 'array'),
  interests JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(interests) = 'array'),
  recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  legal_basis VARCHAR(120) NOT NULL DEFAULT 'consimțământ explicit',
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communication_dispatch_recipients (
  id BIGSERIAL PRIMARY KEY,
  dispatch_id BIGINT NOT NULL REFERENCES communication_dispatches(id) ON DELETE CASCADE,
  consent_id BIGINT NOT NULL REFERENCES communication_consents(id) ON DELETE RESTRICT,
  destination VARCHAR(180) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'eligible'
    CHECK (status IN ('eligible', 'queued', 'sent', 'failed', 'skipped')),
  reason VARCHAR(240) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dispatch_id, consent_id)
);

CREATE INDEX IF NOT EXISTS idx_communication_dispatches_created
  ON communication_dispatches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_dispatch_recipients_status
  ON communication_dispatch_recipients (dispatch_id, status);

CREATE TABLE IF NOT EXISTS member_documents (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  description VARCHAR(360) NOT NULL DEFAULT '',
  category VARCHAR(80) NOT NULL,
  path VARCHAR(320) NOT NULL UNIQUE,
  visibility VARCHAR(20) NOT NULL DEFAULT 'members'
    CHECK (visibility IN ('members', 'active_members', 'leadership')),
  status VARCHAR(20) NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO member_documents (title, description, category, path, visibility, sort_order)
VALUES
  ('Statutul PCS', 'Regulile de organizare, drepturile și obligațiile membrilor.', 'Organizare', '/documente/statut', 'members', 10),
  ('Programul politic', 'Prioritățile și angajamentele politice asumate de PCS.', 'Politici', '/documente/program-politic', 'members', 20),
  ('Regulamentul GDPR', 'Regulile de protecție a datelor și exercitarea drepturilor persoanei vizate.', 'Protecția datelor', '/documente/regulament-gdpr', 'active_members', 30)
ON CONFLICT (path) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    visibility = EXCLUDED.visibility,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS membership_dues (
  id BIGSERIAL PRIMARY KEY,
  membership_id BIGINT NOT NULL REFERENCES membership_records(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'RON',
  status VARCHAR(20) NOT NULL DEFAULT 'due'
    CHECK (status IN ('not_due', 'due', 'paid', 'waived', 'overdue', 'cancelled')),
  due_at DATE,
  paid_at TIMESTAMPTZ,
  reference VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_end >= period_start),
  UNIQUE (membership_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_membership_dues_member_period
  ON membership_dues (membership_id, period_start DESC);

CREATE TABLE IF NOT EXISTS regulated_module_gates (
  module_key VARCHAR(30) PRIMARY KEY CHECK (module_key IN ('financial_transparency', 'electoral')),
  legal_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (legal_status IN ('pending', 'approved', 'rejected', 'changes_required')),
  dpo_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (dpo_status IN ('pending', 'approved', 'rejected', 'changes_required')),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  legal_notes TEXT NOT NULL DEFAULT '',
  dpo_notes TEXT NOT NULL DEFAULT '',
  legal_approved_at TIMESTAMPTZ,
  dpo_approved_at TIMESTAMPTZ,
  enabled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT enabled OR (legal_status = 'approved' AND dpo_status = 'approved'))
);

INSERT INTO regulated_module_gates (module_key)
VALUES ('financial_transparency'), ('electoral')
ON CONFLICT (module_key) DO NOTHING;

-- Structurile reale există, însă datele rămân nepublicate până când poarta
-- aferentă are ambele avize și este activată explicit.
CREATE TABLE IF NOT EXISTS financial_transparency_records (
  id BIGSERIAL PRIMARY KEY,
  record_type VARCHAR(20) NOT NULL CHECK (record_type IN ('income', 'expense')),
  source VARCHAR(240) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'RON',
  record_year INTEGER NOT NULL CHECK (record_year BETWEEN 2000 AND 2100),
  occurred_at DATE,
  document_path VARCHAR(320) NOT NULL DEFAULT '',
  publication_status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'reviewed', 'published', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_financial_transparency_public
  ON financial_transparency_records (record_year DESC, record_type, occurred_at DESC)
  WHERE publication_status = 'published';

CREATE TABLE IF NOT EXISTS electoral_operations (
  id BIGSERIAL PRIMARY KEY,
  election_type VARCHAR(30) NOT NULL
    CHECK (election_type IN ('parlamentare', 'locale', 'prezidentiale', 'europarlamentare')),
  election_year INTEGER NOT NULL CHECK (election_year BETWEEN 2000 AND 2100),
  scope VARCHAR(180) NOT NULL,
  candidates_count INTEGER NOT NULL DEFAULT 0 CHECK (candidates_count >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'validated', 'published', 'archived')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_electoral_operations_public
  ON electoral_operations (election_year DESC, election_type)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_mobilization_actions_organization_status
  ON mobilization_actions (organization_id, status, starts_at);
CREATE INDEX IF NOT EXISTS idx_mobilization_actions_coordinator
  ON mobilization_actions (coordinator_user_id, status);
