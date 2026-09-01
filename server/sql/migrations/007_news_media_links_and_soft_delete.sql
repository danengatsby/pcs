ALTER TABLE news_media_assets
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

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

CREATE INDEX IF NOT EXISTS idx_news_media_links_news_sort
  ON news_media_links (news_id, sort_order ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_news_media_links_asset
  ON news_media_links (asset_id);

CREATE INDEX IF NOT EXISTS idx_news_media_assets_not_deleted_created_at
  ON news_media_assets (created_at DESC)
  WHERE deleted_at IS NULL;

INSERT INTO news_media_links (
  news_id,
  asset_id,
  kind,
  title,
  alt,
  sort_order
)
SELECT
  n.id AS news_id,
  a.id AS asset_id,
  CASE
    WHEN (media_entry.item ->> 'kind') IN ('image', 'video', 'document') THEN (media_entry.item ->> 'kind')::varchar(20)
    ELSE a.kind
  END AS kind,
  LEFT(COALESCE(media_entry.item ->> 'title', ''), 180) AS title,
  LEFT(COALESCE(media_entry.item ->> 'alt', ''), 240) AS alt,
  GREATEST(0, media_entry.ordinality - 1)::integer AS sort_order
FROM news n
JOIN LATERAL jsonb_array_elements(COALESCE(n.media, '[]'::jsonb)) WITH ORDINALITY AS media_entry(item, ordinality)
  ON TRUE
JOIN news_media_assets a
  ON a.public_url = media_entry.item ->> 'url'
 AND a.deleted_at IS NULL
ON CONFLICT (news_id, asset_id) DO NOTHING;
