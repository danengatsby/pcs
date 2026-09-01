ALTER TABLE auth_refresh_tokens
ADD COLUMN IF NOT EXISTS csrf_token_hash CHAR(64);

UPDATE auth_refresh_tokens
SET csrf_token_hash = token_hash
WHERE csrf_token_hash IS NULL;

ALTER TABLE auth_refresh_tokens
ALTER COLUMN csrf_token_hash SET NOT NULL;

ALTER TABLE news
DROP COLUMN IF EXISTS media;
