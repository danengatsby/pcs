CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  summary VARCHAR(320) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'Comunicat',
  content TEXT NOT NULL DEFAULT '',
  source_name VARCHAR(160) NOT NULL DEFAULT '',
  source_url VARCHAR(1000) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'scheduled', 'published')),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_source_url_unique
  ON news (source_url)
  WHERE source_url <> '';

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'ADERENT'
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
    ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION normalize_county_text(input_value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(
    lower(
      translate(
        COALESCE(input_value, ''),
        'ăâîșşțţĂÂÎȘŞȚŢ',
        'aaissttAAISSTT'
      )
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

CREATE TABLE IF NOT EXISTS counties (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  normalized_name VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO counties (name, normalized_name)
VALUES
  ('Alba', normalize_county_text('Alba')),
  ('Arad', normalize_county_text('Arad')),
  ('Argeș', normalize_county_text('Argeș')),
  ('Bacău', normalize_county_text('Bacău')),
  ('Bihor', normalize_county_text('Bihor')),
  ('Bistrița-Năsăud', normalize_county_text('Bistrița-Năsăud')),
  ('Botoșani', normalize_county_text('Botoșani')),
  ('Brașov', normalize_county_text('Brașov')),
  ('Brăila', normalize_county_text('Brăila')),
  ('Buzău', normalize_county_text('Buzău')),
  ('Caraș-Severin', normalize_county_text('Caraș-Severin')),
  ('Călărași', normalize_county_text('Călărași')),
  ('Cluj', normalize_county_text('Cluj')),
  ('Constanța', normalize_county_text('Constanța')),
  ('Covasna', normalize_county_text('Covasna')),
  ('Dâmbovița', normalize_county_text('Dâmbovița')),
  ('Dolj', normalize_county_text('Dolj')),
  ('Galați', normalize_county_text('Galați')),
  ('Giurgiu', normalize_county_text('Giurgiu')),
  ('Gorj', normalize_county_text('Gorj')),
  ('Harghita', normalize_county_text('Harghita')),
  ('Hunedoara', normalize_county_text('Hunedoara')),
  ('Ialomița', normalize_county_text('Ialomița')),
  ('Iași', normalize_county_text('Iași')),
  ('Ilfov', normalize_county_text('Ilfov')),
  ('Maramureș', normalize_county_text('Maramureș')),
  ('Mehedinți', normalize_county_text('Mehedinți')),
  ('Mureș', normalize_county_text('Mureș')),
  ('Neamț', normalize_county_text('Neamț')),
  ('Olt', normalize_county_text('Olt')),
  ('Prahova', normalize_county_text('Prahova')),
  ('Satu Mare', normalize_county_text('Satu Mare')),
  ('Sălaj', normalize_county_text('Sălaj')),
  ('Sibiu', normalize_county_text('Sibiu')),
  ('Suceava', normalize_county_text('Suceava')),
  ('Teleorman', normalize_county_text('Teleorman')),
  ('Timiș', normalize_county_text('Timiș')),
  ('Tulcea', normalize_county_text('Tulcea')),
  ('Vaslui', normalize_county_text('Vaslui')),
  ('Vâlcea', normalize_county_text('Vâlcea')),
  ('Vrancea', normalize_county_text('Vrancea')),
  ('București', normalize_county_text('București'))
ON CONFLICT (normalized_name) DO UPDATE
SET name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS volunteers (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  county VARCHAR(120) NOT NULL,
  county_id INTEGER NOT NULL REFERENCES counties(id) ON DELETE RESTRICT,
  locality VARCHAR(120) NOT NULL,
  skills VARCHAR(220) NOT NULL DEFAULT '',
  motivation TEXT NOT NULL,
  workflow_status VARCHAR(20) NOT NULL DEFAULT 'nou'
    CHECK (workflow_status IN ('nou', 'validat', 'contactat', 'activ')),
  internal_notes TEXT NOT NULL DEFAULT '',
  status_updated_at TIMESTAMPTZ,
  status_updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS auth_revoked_tokens (
  jti VARCHAR(120) PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  csrf_token_hash CHAR(64) NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  rotated_from_id BIGINT REFERENCES auth_refresh_tokens(id) ON DELETE SET NULL,
  rotated_to_id BIGINT REFERENCES auth_refresh_tokens(id) ON DELETE SET NULL,
  user_agent VARCHAR(255) NOT NULL DEFAULT '',
  ip_address VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  actor_email VARCHAR(180) NOT NULL DEFAULT '',
  actor_role VARCHAR(20) NOT NULL DEFAULT '',
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(80) NOT NULL,
  target_id VARCHAR(120) NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_media_assets (
  id BIGSERIAL PRIMARY KEY,
  storage_path VARCHAR(600) NOT NULL UNIQUE,
  public_url VARCHAR(600) NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('image', 'video', 'document')),
  title VARCHAR(180) NOT NULL DEFAULT '',
  alt VARCHAR(240) NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_media_links (
  id BIGSERIAL PRIMARY KEY,
  news_id INTEGER NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  asset_id BIGINT NOT NULL REFERENCES news_media_assets(id) ON DELETE RESTRICT,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('image', 'video', 'document')),
  title VARCHAR(180) NOT NULL DEFAULT '',
  alt VARCHAR(240) NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (news_id, asset_id)
);

CREATE TABLE IF NOT EXISTS notification_email_outbox (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(120) NOT NULL,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'retry', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 6 CHECK (max_attempts >= 1),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT NOT NULL DEFAULT '',
  locked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_published_at ON news (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_status_published_at ON news (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_counties_name ON counties (name);
CREATE INDEX IF NOT EXISTS idx_volunteers_created_at ON volunteers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_volunteers_workflow_status ON volunteers (workflow_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_volunteers_county_id_created_at ON volunteers (county_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_entries_updated_at ON rate_limit_entries (updated_at);
CREATE INDEX IF NOT EXISTS idx_auth_revoked_tokens_expires_at ON auth_revoked_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id ON auth_refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires_at ON auth_refresh_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_revoked_at ON auth_refresh_tokens (revoked_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_created_at ON admin_audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_user_id ON admin_audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_news_media_assets_created_at ON news_media_assets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_media_assets_kind_created_at ON news_media_assets (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_media_assets_not_deleted_created_at ON news_media_assets (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_news_media_links_news_sort ON news_media_links (news_id, sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_news_media_links_asset ON news_media_links (asset_id);
CREATE INDEX IF NOT EXISTS idx_notification_email_outbox_dispatch ON notification_email_outbox (next_attempt_at ASC, id ASC) WHERE status IN ('pending', 'retry');
CREATE INDEX IF NOT EXISTS idx_notification_email_outbox_status_created_at ON notification_email_outbox (status, created_at DESC);

CREATE OR REPLACE FUNCTION sync_volunteer_county_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  county_row RECORD;
BEGIN
  IF NEW.county_id IS NOT NULL THEN
    SELECT c.id, c.name
    INTO county_row
    FROM counties c
    WHERE c.id = NEW.county_id
    LIMIT 1;

    IF FOUND THEN
      NEW.county := county_row.name;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.county IS NOT NULL AND BTRIM(NEW.county) <> '' THEN
    SELECT c.id, c.name
    INTO county_row
    FROM counties c
    WHERE c.normalized_name = normalize_county_text(NEW.county)
    LIMIT 1;

    IF FOUND THEN
      NEW.county_id := county_row.id;
      NEW.county := county_row.name;
      RETURN NEW;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_volunteers_sync_county_fields ON volunteers;

CREATE TRIGGER trg_volunteers_sync_county_fields
BEFORE INSERT OR UPDATE OF county, county_id ON volunteers
FOR EACH ROW
EXECUTE FUNCTION sync_volunteer_county_fields();

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
    CREATE INDEX IF NOT EXISTS idx_volunteers_full_name_trgm ON volunteers USING gin (full_name gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_volunteers_email_trgm ON volunteers USING gin (email gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_volunteers_county_trgm ON volunteers USING gin (county gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_volunteers_locality_trgm ON volunteers USING gin (locality gin_trgm_ops);
  ELSE
    RAISE NOTICE 'Skipping volunteers trigram indexes because pg_trgm is not available.';
  END IF;
END $$;

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
