-- Indexuri de suport pentru query-urile administrative nou mutate in DB.
-- Completeaza indexurile deja existente pe LOWER(email) si trigramurile pentru volunteers.

CREATE INDEX IF NOT EXISTS idx_users_role_created_at_id
  ON users (role, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_volunteers_workflow_status_created_at_id
  ON volunteers (workflow_status, created_at DESC, id DESC);

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping pg_trgm extension creation due insufficient privileges.';
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm
      ON users USING gin (full_name gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS idx_users_email_trgm
      ON users USING gin (email gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS idx_volunteers_skills_trgm
      ON volunteers USING gin (skills gin_trgm_ops);
  ELSE
    RAISE NOTICE 'Skipping admin trigram indexes because pg_trgm is not available.';
  END IF;
END $$;
