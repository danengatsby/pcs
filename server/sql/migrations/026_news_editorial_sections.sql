-- Aliniază materialele PCS existente la taxonomia editorială publică.
-- Articolele cu sursă externă își păstrează categoria tematică și sunt
-- identificate drept „Informații din presă” prin atribuirea sursei.

UPDATE news
SET category = 'Poziție PCS'
WHERE source_url = ''
  AND title = 'PCS propune pachetul de transparenta administrativa';

UPDATE news
SET category = 'Activitate locală'
WHERE source_url = ''
  AND category IN ('Eveniment', 'Initiativa', 'Inițiativă');
