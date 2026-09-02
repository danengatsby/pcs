-- Evidență distinctă pentru calitatea de aderent/membru.
-- Rolul de autentificare rămâne un mecanism de autorizare; starea apartenenței,
-- organizația și istoricul deciziilor sunt păstrate separat și auditabil.

CREATE TABLE IF NOT EXISTS membership_records (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  volunteer_id BIGINT UNIQUE REFERENCES volunteers(id) ON DELETE SET NULL,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  organization_id VARCHAR(80) REFERENCES organizations(id) ON DELETE RESTRICT,
  validated_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status_reason TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_membership_records_subject CHECK (user_id IS NOT NULL OR volunteer_id IS NOT NULL),
  CONSTRAINT chk_membership_records_status CHECK (
    status IN ('pending', 'adherent', 'active', 'suspended', 'terminated')
  ),
  CONSTRAINT chk_membership_records_version CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_records_email_unique
  ON membership_records (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_membership_records_status_updated
  ON membership_records (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_membership_records_organization_status
  ON membership_records (organization_id, status);

CREATE TABLE IF NOT EXISTS membership_events (
  id BIGSERIAL PRIMARY KEY,
  membership_id BIGINT NOT NULL REFERENCES membership_records(id) ON DELETE CASCADE,
  action VARCHAR(30) NOT NULL,
  previous_status VARCHAR(20),
  next_status VARCHAR(20) NOT NULL,
  previous_organization_id VARCHAR(80),
  next_organization_id VARCHAR(80),
  reason TEXT NOT NULL DEFAULT '',
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_membership_events_action CHECK (
    action IN ('import', 'validate', 'promote', 'suspend', 'reactivate', 'transfer', 'terminate')
  ),
  CONSTRAINT chk_membership_events_previous_status CHECK (
    previous_status IS NULL
    OR previous_status IN ('pending', 'adherent', 'active', 'suspended', 'terminated')
  ),
  CONSTRAINT chk_membership_events_next_status CHECK (
    next_status IN ('pending', 'adherent', 'active', 'suspended', 'terminated')
  )
);

CREATE INDEX IF NOT EXISTS idx_membership_events_membership_created
  ON membership_events (membership_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_membership_events_actor
  ON membership_events (actor_user_id);

WITH ranked_users AS (
  SELECT
    u.*,
    ROW_NUMBER() OVER (PARTITION BY LOWER(u.email) ORDER BY u.id DESC) AS row_number
  FROM users u
),
latest_users AS (
  SELECT * FROM ranked_users WHERE row_number = 1
),
ranked_volunteers AS (
  SELECT
    v.*,
    ROW_NUMBER() OVER (PARTITION BY LOWER(v.email) ORDER BY v.id DESC) AS row_number
  FROM volunteers v
),
latest_volunteers AS (
  SELECT * FROM ranked_volunteers WHERE row_number = 1
),
subjects AS (
  SELECT
    u.id AS user_id,
    v.id AS volunteer_id,
    COALESCE(NULLIF(BTRIM(u.full_name), ''), v.full_name) AS full_name,
    LOWER(COALESCE(u.email, v.email)) AS email,
    CASE
      WHEN u.role IN ('MEMBRU', 'CONSILIER', 'SECRETAR', 'VICEPRESEDINTE', 'PRESEDINTE') THEN 'active'
      WHEN u.role = 'ADERENT' THEN 'adherent'
      WHEN v.workflow_status = 'activ' THEN 'active'
      WHEN v.workflow_status IN ('validat', 'contactat') THEN 'adherent'
      ELSE 'pending'
    END AS membership_status,
    COALESCE(v.status_updated_at, v.created_at, u.created_at, NOW()) AS decision_at,
    LEAST(COALESCE(u.created_at, NOW()), COALESCE(v.created_at, NOW())) AS created_at
  FROM latest_users u
  FULL OUTER JOIN latest_volunteers v ON LOWER(v.email) = LOWER(u.email)
  WHERE v.id IS NOT NULL
     OR u.role IN ('ADERENT', 'MEMBRU', 'CONSILIER', 'SECRETAR', 'VICEPRESEDINTE', 'PRESEDINTE')
)
INSERT INTO membership_records (
  user_id,
  volunteer_id,
  full_name,
  email,
  status,
  validated_at,
  joined_at,
  created_at,
  updated_at
)
SELECT
  user_id,
  volunteer_id,
  full_name,
  email,
  membership_status,
  CASE WHEN membership_status IN ('adherent', 'active') THEN decision_at END,
  CASE WHEN membership_status = 'active' THEN decision_at END,
  created_at,
  decision_at
FROM subjects
ON CONFLICT DO NOTHING;

INSERT INTO membership_events (
  membership_id,
  action,
  previous_status,
  next_status,
  next_organization_id,
  reason,
  effective_at,
  created_at
)
SELECT
  mr.id,
  'import',
  NULL,
  mr.status,
  mr.organization_id,
  'Import automat din evidența existentă',
  mr.updated_at,
  mr.updated_at
FROM membership_records mr
WHERE NOT EXISTS (
  SELECT 1
  FROM membership_events me
  WHERE me.membership_id = mr.id
);
