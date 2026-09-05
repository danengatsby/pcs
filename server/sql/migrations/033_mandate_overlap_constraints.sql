CREATE OR REPLACE FUNCTION prevent_overlapping_organization_mandates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('active', 'planned') AND EXISTS (
    SELECT 1
    FROM organization_leadership_mandates existing
    WHERE existing.id <> COALESCE(NEW.id, 0)
      AND existing.organization_id = NEW.organization_id
      AND existing.status IN ('active', 'planned')
      AND NEW.started_at < COALESCE(existing.ended_at, 'infinity'::date)
      AND COALESCE(NEW.ended_at, 'infinity'::date) > existing.started_at
      AND (
        LOWER(BTRIM(existing.position_title)) = LOWER(BTRIM(NEW.position_title))
        OR (NEW.user_id IS NOT NULL AND existing.user_id = NEW.user_id)
      )
  ) THEN
    RAISE EXCEPTION 'Mandatul se suprapune cu o funcție sau un titular existent.'
      USING ERRCODE = '23505', CONSTRAINT = 'organization_mandates_no_overlap';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_mandates_no_overlap_trigger
  ON organization_leadership_mandates;
CREATE TRIGGER organization_mandates_no_overlap_trigger
  BEFORE INSERT OR UPDATE OF organization_id, user_id, position_title, started_at, ended_at, status
  ON organization_leadership_mandates
  FOR EACH ROW
  EXECUTE FUNCTION prevent_overlapping_organization_mandates();