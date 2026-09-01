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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_media_assets_created_at
  ON news_media_assets (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_media_assets_kind_created_at
  ON news_media_assets (kind, created_at DESC);
