INSERT INTO news (title, summary, category, content, published_at)
SELECT
  seed.title,
  seed.summary,
  seed.category,
  seed.content,
  seed.published_at
FROM (
  VALUES
    (
      'PCS propune pachetul de transparenta administrativa',
      'Noul pachet legislativ simplifica accesul cetatenilor la date publice.',
      'Poziție PCS',
      'Propunerea PCS include raportare trimestriala digitala si publicarea automata a contractelor publice.',
      NOW() - INTERVAL '5 days'
    ),
    (
      'Consultari regionale pentru strategia de educatie',
      'Echipele PCS au inceput sesiuni publice in 12 judete.',
      'Activitate locală',
      'Sunt colectate propuneri din partea profesorilor, elevilor si antreprenorilor locali.',
      NOW() - INTERVAL '3 days'
    ),
    (
      'Program pilot pentru incubatoare civice locale',
      'PCS lanseaza un program de micro-finantare pentru initiative comunitare.',
      'Activitate locală',
      'Programul include mentorat, sprijin logistic si raportare de impact.',
      NOW() - INTERVAL '1 day'
    )
) AS seed(title, summary, category, content, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM news existing
  WHERE existing.title = seed.title
);
