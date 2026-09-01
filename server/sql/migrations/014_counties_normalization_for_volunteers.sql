-- Normalizeaza aderentii pe judete oficiale (42 + Bucuresti) si adauga foreign key in volunteers.

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

CREATE INDEX IF NOT EXISTS idx_counties_name ON counties (name);

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

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS county_id INTEGER;

UPDATE volunteers AS v
SET
  county_id = c.id,
  county = c.name
FROM counties AS c
WHERE c.normalized_name = normalize_county_text(v.county)
  AND (
    v.county_id IS NULL
    OR v.county_id <> c.id
    OR v.county <> c.name
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_volunteers_county_id'
  ) THEN
    ALTER TABLE volunteers
    ADD CONSTRAINT fk_volunteers_county_id
    FOREIGN KEY (county_id) REFERENCES counties(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_volunteers_county_id_created_at
  ON volunteers (county_id, created_at DESC);

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
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO missing_count
  FROM volunteers
  WHERE county_id IS NULL;

  IF missing_count = 0 THEN
    ALTER TABLE volunteers
    ALTER COLUMN county_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'volunteers.county_id ramane nullable (% randuri fara mapare).', missing_count;
  END IF;
END $$;
