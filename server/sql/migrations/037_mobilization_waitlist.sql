ALTER TABLE mobilization_participants
  DROP CONSTRAINT mobilization_participants_status_check,
  ADD CONSTRAINT mobilization_participants_status_check
    CHECK (status IN ('invited', 'confirmed', 'waitlisted', 'declined', 'active', 'in_progress', 'reported', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_mobilization_participants_capacity
  ON mobilization_participants (action_id, status)
  WHERE is_demo = FALSE;
