-- Rezolvarea accesului administrativ pornește de la mandatele active ale
-- utilizatorului și extinde aria către organizațiile subordonate.

CREATE INDEX IF NOT EXISTS idx_organization_mandates_access_scope
  ON organization_leadership_mandates (
    user_id,
    status,
    started_at,
    ended_at,
    organization_id
  )
  WHERE user_id IS NOT NULL;
