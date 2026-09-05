-- Datele demonstrative nu pot fi publicate sau păstrate într-o instanță production.
-- Conținutul public este fail-closed: starea operațională nu mai echivalează singură
-- cu aprobarea editorială.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE membership_records
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE membership_events
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE organization_objectives
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE mobilization_responses
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE mobilization_participants
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE communication_consents
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE membership_dues
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE news
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS public_approved_by BIGINT;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS public_approved_by BIGINT;

ALTER TABLE organization_leadership_mandates
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS public_approved_by BIGINT;

ALTER TABLE mobilization_actions
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS public_approved_by BIGINT,
  ADD COLUMN IF NOT EXISTS public_response_count INTEGER,
  ADD COLUMN IF NOT EXISTS response_count_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_count_approved_by BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_news_public_approved_by') THEN
    ALTER TABLE news ADD CONSTRAINT fk_news_public_approved_by
      FOREIGN KEY (public_approved_by) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_organizations_public_approved_by') THEN
    ALTER TABLE organizations ADD CONSTRAINT fk_organizations_public_approved_by
      FOREIGN KEY (public_approved_by) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_organization_mandates_public_approved_by') THEN
    ALTER TABLE organization_leadership_mandates ADD CONSTRAINT fk_organization_mandates_public_approved_by
      FOREIGN KEY (public_approved_by) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mobilization_actions_public_approved_by') THEN
    ALTER TABLE mobilization_actions ADD CONSTRAINT fk_mobilization_actions_public_approved_by
      FOREIGN KEY (public_approved_by) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mobilization_actions_response_count_approved_by') THEN
    ALTER TABLE mobilization_actions ADD CONSTRAINT fk_mobilization_actions_response_count_approved_by
      FOREIGN KEY (response_count_approved_by) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE news
  ADD CONSTRAINT chk_news_demo_not_public
  CHECK (NOT is_demo OR public_approved_at IS NULL);

ALTER TABLE organizations
  ADD CONSTRAINT chk_organizations_demo_not_public
  CHECK (NOT is_demo OR public_approved_at IS NULL);

ALTER TABLE organization_leadership_mandates
  ADD CONSTRAINT chk_organization_mandates_demo_not_public
  CHECK (NOT is_demo OR public_approved_at IS NULL);

ALTER TABLE mobilization_actions
  ADD CONSTRAINT chk_mobilization_actions_demo_not_public
  CHECK (NOT is_demo OR public_approved_at IS NULL),
  ADD CONSTRAINT chk_mobilization_actions_public_response_count
  CHECK (public_response_count IS NULL OR public_response_count >= 0);

CREATE TABLE IF NOT EXISTS public_indicators (
  key VARCHAR(80) PRIMARY KEY,
  value BIGINT NOT NULL CHECK (value >= 0),
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  calculated_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_public_indicators_demo_not_approved
    CHECK (NOT is_demo OR approved_at IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_news_public_approval
  ON news (published_at DESC, id DESC)
  WHERE is_demo = FALSE AND public_approved_at IS NOT NULL AND public_approved_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_public_approval
  ON organizations (level, name)
  WHERE is_demo = FALSE AND public_approved_at IS NOT NULL AND public_approved_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organization_mandates_public_approval
  ON organization_leadership_mandates (organization_id, started_at, id)
  WHERE is_demo = FALSE AND public_approved_at IS NOT NULL AND public_approved_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mobilization_actions_public_approval
  ON mobilization_actions (sort_order, starts_at, id)
  WHERE is_demo = FALSE AND public_approved_at IS NOT NULL AND public_approved_by IS NOT NULL;

-- Amprente deterministe ale generatorului demonstrativ existent.
UPDATE users
SET is_demo = TRUE
WHERE email ILIKE '%@seed.pcs.local';

UPDATE volunteers
SET is_demo = TRUE
WHERE email ILIKE '%@seed.pcs.local'
   OR internal_notes ILIKE 'Date demonstrative.%'
   OR crm_tags @> '["seed-demo"]'::jsonb;

UPDATE membership_records
SET is_demo = TRUE
WHERE email ILIKE '%@seed.pcs.local'
   OR approval_body ILIKE '%demonstrativ%'
   OR status_reason ILIKE '%demonstrativ%';

UPDATE membership_events event
SET is_demo = TRUE
WHERE event.reason ILIKE '%demonstrativ%'
   OR EXISTS (
     SELECT 1 FROM membership_records membership
     WHERE membership.id = event.membership_id AND membership.is_demo = TRUE
   );

UPDATE organizations
SET is_demo = TRUE,
    public_approved_at = NULL,
    public_approved_by = NULL
WHERE id LIKE 'seed-org-%'
   OR name ILIKE '%(Demo)%'
   OR headquarters ILIKE '%demonstrativ%';

UPDATE organization_leadership_mandates mandate
SET is_demo = TRUE,
    public_approved_at = NULL,
    public_approved_by = NULL
WHERE EXISTS (
  SELECT 1 FROM organizations organization
  WHERE organization.id = mandate.organization_id AND organization.is_demo = TRUE
);

UPDATE organization_objectives objective
SET is_demo = TRUE
WHERE objective.title LIKE '[Demo] %'
   OR objective.description ILIKE '%demonstrativ%'
   OR EXISTS (
     SELECT 1 FROM organizations organization
     WHERE organization.id = objective.organization_id AND organization.is_demo = TRUE
   );

UPDATE mobilization_responses
SET is_demo = TRUE
WHERE email ILIKE '%@seed.pcs.local'
   OR message ILIKE '%demonstrativ%';

UPDATE mobilization_participants participant
SET is_demo = TRUE
WHERE participant.email ILIKE '%@seed.pcs.local'
   OR participant.notes ILIKE '%demonstrativ%'
   OR participant.report ILIKE '%demonstrativ%'
   OR participant.result ILIKE '%demonstrativ%'
   OR EXISTS (
     SELECT 1 FROM membership_records membership
     WHERE membership.id = participant.membership_id AND membership.is_demo = TRUE
   );

UPDATE communication_consents
SET is_demo = TRUE
WHERE email ILIKE '%@seed.pcs.local'
   OR source = 'seed_demo'
   OR evidence @> '{"demo":true}'::jsonb;

UPDATE membership_dues due
SET is_demo = TRUE
WHERE due.reference LIKE 'DEMO-%'
   OR EXISTS (
     SELECT 1 FROM membership_records membership
     WHERE membership.id = due.membership_id AND membership.is_demo = TRUE
   );

UPDATE mobilization_actions
SET is_demo = TRUE,
    public_approved_at = NULL,
    public_approved_by = NULL,
    public_response_count = NULL,
    response_count_approved_at = NULL,
    response_count_approved_by = NULL
WHERE organization_id LIKE 'seed-org-%'
   OR objective ILIKE '%demonstrativ%';

UPDATE news
SET is_demo = TRUE,
    public_approved_at = NULL,
    public_approved_by = NULL
WHERE title IN (
  'PCS propune pachetul de transparenta administrativa',
  'Consultari regionale pentru strategia de educatie',
  'Program pilot pentru incubatoare civice locale'
);
