ALTER TABLE news
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_news_status'
  ) THEN
    ALTER TABLE news
    ADD CONSTRAINT chk_news_status
    CHECK (status IN ('draft', 'scheduled', 'published'));
  END IF;
END $$;

ALTER TABLE news
ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE news
ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE news
SET tags = '[]'::jsonb
WHERE tags IS NULL
   OR jsonb_typeof(tags) <> 'array';

UPDATE news
SET media = '[]'::jsonb
WHERE media IS NULL
   OR jsonb_typeof(media) <> 'array';

CREATE INDEX IF NOT EXISTS idx_news_status_published_at
  ON news (status, published_at DESC);
