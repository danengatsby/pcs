-- Renumeste rolul SIMPATIZANT in SUSTINATOR si reasaza constrangerea finala pe users.role.
DO $$
DECLARE
  existing_constraint_name TEXT;
BEGIN
  FOR existing_constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'users'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', existing_constraint_name);
  END LOOP;
END $$;

UPDATE users
SET role = UPPER(BTRIM(role))
WHERE role <> UPPER(BTRIM(role));

UPDATE users
SET role = 'PRESEDINTE'
WHERE role = 'ADMIN';

UPDATE users
SET role = 'SUSTINATOR'
WHERE role = 'SIMPATIZANT';

UPDATE users
SET role = 'SUSTINATOR'
WHERE role NOT IN (
  'SUSTINATOR',
  'ADERENT',
  'MEMBRU',
  'CONSILIER',
  'SECRETAR',
  'VICEPRESEDINTE',
  'PRESEDINTE'
);

ALTER TABLE users
ADD CONSTRAINT chk_users_role
CHECK (
  role IN (
    'SUSTINATOR',
    'ADERENT',
    'MEMBRU',
    'CONSILIER',
    'SECRETAR',
    'VICEPRESEDINTE',
    'PRESEDINTE'
  )
);
