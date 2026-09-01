-- Normalize emails before deduplication so the unique constraint is deterministic.
UPDATE volunteers
SET email = LOWER(BTRIM(email))
WHERE email <> LOWER(BTRIM(email));

UPDATE users
SET email = LOWER(BTRIM(email))
WHERE email <> LOWER(BTRIM(email));

-- Keep the oldest volunteer row for duplicate emails and remove the rest.
WITH ranked_volunteers AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(BTRIM(email))
      ORDER BY created_at ASC, id ASC
    ) AS row_number
  FROM volunteers
)
DELETE FROM volunteers AS v
USING ranked_volunteers AS rv
WHERE v.id = rv.id
  AND rv.row_number > 1;

-- Keep one user row per email.
-- Priority: highest role first (ADMIN > MEMBRU > ADERENT), then latest account.
WITH ranked_users AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(BTRIM(email))
      ORDER BY
        CASE role
          WHEN 'ADMIN' THEN 3
          WHEN 'MEMBRU' THEN 2
          ELSE 1
        END DESC,
        created_at DESC,
        id DESC
    ) AS row_number
  FROM users
)
DELETE FROM users AS u
USING ranked_users AS ru
WHERE u.id = ru.id
  AND ru.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_volunteers_email_unique ON volunteers (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (LOWER(email));
