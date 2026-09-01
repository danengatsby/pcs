-- Migration 020: Source attribution for news and an initial senior-news digest.

ALTER TABLE news
  ADD COLUMN IF NOT EXISTS source_name VARCHAR(160) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_url VARCHAR(1000) NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_source_url_unique
  ON news (source_url)
  WHERE source_url <> '';

INSERT INTO news (
  title,
  summary,
  category,
  content,
  status,
  tags,
  published_at,
  source_name,
  source_url
)
VALUES
  (
    'Sistemul public de pensii: aproape 4,68 milioane de beneficiari în iulie',
    'Datele centralizate de CNPP indică 4.677.789 de beneficiari și o pensie medie de 2.785 de lei în iulie 2026.',
    'Pensii',
    'La sfârșitul lunii iulie 2026 erau înregistrați 4.677.789 de beneficiari ai sistemului public de pensii, cu 1.003 mai puțini decât în luna precedentă. Pensia medie a fost de 2.785 de lei, iar pensia medie pentru limită de vârstă a ajuns la 3.117 lei. Datele oferă o imagine actualizată asupra dimensiunii și structurii sistemului public de pensii.',
    'published',
    '["seniori", "pensii", "CNPP"]'::jsonb,
    TIMESTAMPTZ '2026-08-22 09:00:00+03',
    'AGERPRES',
    'https://agerpres.ro/economic/2026/08/22/cnpp-4-677-789-de-pensionari-la-finele-lunii-iulie-2026-pensia-medie-a-fost-de-2-785-de-lei--1586929'
  ),
  (
    'Peste 4.400 de apeluri la Telefonul Vârstnicului în prima jumătate a anului',
    'Seniorii au cerut în special informații de încredere, soluții de îngrijire și sprijin pentru combaterea singurătății.',
    'Sprijin social',
    'Telefonul Vârstnicului a înregistrat 4.425 de apeluri în primele șase luni din 2026. Dintre persoanele care au apelat pentru prima dată, peste jumătate locuiesc singure. Solicitările au vizat servicii sociale și de îngrijire, sprijin material, consiliere și suport emoțional. Linia gratuită 0800 460 001 oferă îndrumare seniorilor și aparținătorilor din întreaga țară.',
    'published',
    '["seniori", "sprijin", "singurătate"]'::jsonb,
    TIMESTAMPTZ '2026-07-13 09:00:00+03',
    'AGERPRES / Fundația Regală Margareta a României',
    'https://agerpres.ro/comunicate/2026/07/13/comunicat-de-presa---fundatia-regala-margareta-a-romaniei--1575544'
  ),
  (
    'Peste 150 de seniori din Oradea au învățat să folosească smartphone-ul',
    'Cursurile gratuite au inclus plăți online, comunicare cu familia și recunoașterea tentativelor de fraudă digitală.',
    'Educație digitală',
    'Peste 150 de persoane cu vârste de peste 60 de ani au participat la cursurile gratuite organizate de Direcția de Asistență Socială Oradea. Seniorii au exersat folosirea telefonului pentru căutarea informațiilor, plata facturilor, apeluri video și mesaje, dar și identificarea fraudelor online. Programul urmează să fie reluat după vacanța de vară.',
    'published',
    '["seniori", "digitalizare", "siguranță online"]'::jsonb,
    TIMESTAMPTZ '2026-07-03 09:00:00+03',
    'AGERPRES',
    'https://agerpres.ro/social/2026/07/03/bihor-seniori-de-peste-60-de-ani-descopera-lumea-digitala-si-folosirea-smartphone-ului-la-das-oradea--1572842'
  ),
  (
    'Consiliul Europei cere servicii de îngrijire mai bune pentru seniorii din România',
    'Recomandările vizează integrarea serviciilor medicale și sociale, finanțarea adecvată și protejarea drepturilor rezidenților.',
    'Drepturi și îngrijire',
    'Comisarul pentru Drepturile Omului al Consiliului Europei recomandă României să dezvolte serviciile de îngrijire pe termen lung și să conecteze mai bine asistența socială cu serviciile medicale. Inspecțiile centrelor ar trebui să urmărească bunăstarea și drepturile rezidenților, iar persoanele vulnerabile trebuie să poată sesiza ușor problemele și să primească soluții efective.',
    'published',
    '["seniori", "îngrijire", "drepturi"]'::jsonb,
    TIMESTAMPTZ '2026-07-21 09:00:00+02',
    'Consiliul Europei',
    'https://www.coe.int/en/web/commissioner/-/council-of-europe-commissioner-raises-challenges-regarding-care-homes-for-older-persons-in-romania'
  ),
  (
    'Telemedicina poate îmbunătăți îngrijirea persoanelor cu demență',
    'O analiză coordonată de OMS Europa arată beneficii pentru pacienți și îngrijitori atunci când tehnologia este susținută de comunitate.',
    'Sănătate',
    'O analiză coordonată de OMS Europa arată că telemedicina poate reduce izolarea, anxietatea și povara deplasărilor pentru persoanele cu demență și pentru îngrijitorii lor. Instrumentele digitale au rezultate mai bune atunci când sunt accesibile, ușor de folosit și integrate cu sprijin comunitar și servicii adaptate vârstei.',
    'published',
    '["seniori", "sănătate", "telemedicină", "demență"]'::jsonb,
    TIMESTAMPTZ '2025-11-06 09:00:00+01',
    'OMS Europa',
    'https://www.who.int/europe/news/item/06-11-2025-telemedicine-shows-promise-in-improving-dementia-care--who-study-finds'
  )
ON CONFLICT (source_url) WHERE source_url <> ''
DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  status = EXCLUDED.status,
  tags = EXCLUDED.tags,
  published_at = EXCLUDED.published_at,
  source_name = EXCLUDED.source_name;
