CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  summary VARCHAR(320) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'Comunicat',
  content TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS volunteers (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  county VARCHAR(120) NOT NULL,
  locality VARCHAR(120) NOT NULL,
  skills VARCHAR(220) NOT NULL DEFAULT '',
  motivation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'ADERENT'
    CHECK (role IN ('ADERENT', 'MEMBRU', 'ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limit_entries (
  scope VARCHAR(100) NOT NULL,
  key_hash CHAR(64) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_news_published_at ON news (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_volunteers_created_at ON volunteers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_entries_updated_at ON rate_limit_entries (updated_at);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT LOWER(email), COUNT(*)
      FROM volunteers
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    RAISE NOTICE 'Skipping idx_volunteers_email_unique because duplicate volunteer emails already exist.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_volunteers_email_unique ON volunteers (LOWER(email));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT LOWER(email), COUNT(*)
      FROM users
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    RAISE NOTICE 'Skipping idx_users_email_unique because duplicate user emails already exist.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (LOWER(email));
  END IF;
END $$;
