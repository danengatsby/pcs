-- Cererile neverificate raman sustinatori pana la validarea administrativa.
-- Rolurile de conducere si membrii promovati nu sunt afectati.
UPDATE users AS u
SET role = 'SUSTINATOR'
FROM volunteers AS v
WHERE LOWER(u.email) = LOWER(v.email)
  AND u.role = 'ADERENT'
  AND v.workflow_status = 'nou';
