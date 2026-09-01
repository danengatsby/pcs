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
    CREATE INDEX IF NOT EXISTS idx_volunteers_full_name_trgm
      ON volunteers USING gin (full_name gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS idx_volunteers_email_trgm
      ON volunteers USING gin (email gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS idx_volunteers_county_trgm
      ON volunteers USING gin (county gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS idx_volunteers_locality_trgm
      ON volunteers USING gin (locality gin_trgm_ops);
  ELSE
    RAISE NOTICE 'Skipping volunteers trigram indexes because pg_trgm is not available.';
  END IF;
END $$;
