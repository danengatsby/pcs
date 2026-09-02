CREATE TABLE IF NOT EXISTS mobilization_actions (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  action_type VARCHAR(30) NOT NULL
    CHECK (action_type IN ('event', 'campaign', 'volunteer_task', 'petition', 'consultation')),
  title VARCHAR(180) NOT NULL,
  summary VARCHAR(360) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  scope VARCHAR(20) NOT NULL DEFAULT 'national'
    CHECK (scope IN ('national', 'local', 'online')),
  county VARCHAR(120) NOT NULL DEFAULT '',
  locality VARCHAR(120) NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  participation_mode VARCHAR(120) NOT NULL DEFAULT '',
  commitment VARCHAR(220) NOT NULL DEFAULT '',
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mobilization_responses (
  id BIGSERIAL PRIMARY KEY,
  action_id BIGINT NOT NULL REFERENCES mobilization_actions(id) ON DELETE CASCADE,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  county VARCHAR(120) NOT NULL,
  locality VARCHAR(120) NOT NULL DEFAULT '',
  interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  availability VARCHAR(30) NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  updates_consent BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_consent BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mobilization_responses_action_email_unique
  ON mobilization_responses (action_id, LOWER(email));

CREATE INDEX IF NOT EXISTS idx_mobilization_actions_public
  ON mobilization_actions (status, sort_order, starts_at);

CREATE INDEX IF NOT EXISTS idx_mobilization_responses_segments
  ON mobilization_responses (county, updates_consent, created_at DESC);

INSERT INTO mobilization_actions (
  slug,
  action_type,
  title,
  summary,
  description,
  scope,
  county,
  locality,
  starts_at,
  ends_at,
  participation_mode,
  commitment,
  capacity,
  sort_order
)
VALUES
  (
    'orientare-voluntari-online-septembrie-2026',
    'event',
    'Sesiune online de orientare pentru voluntari',
    'Află cum funcționează echipele locale, ce roluri sunt deschise și care sunt pașii după înscriere.',
    'Întâlnire introductivă pentru persoanele care vor să sprijine organizarea, comunicarea sau activitatea din comunitate.',
    'online',
    '',
    '',
    '2026-09-17T16:00:00Z',
    '2026-09-17T17:00:00Z',
    'Online · legătura de participare se transmite persoanelor confirmate',
    'Primești confirmarea și detaliile logistice pe email.',
    100,
    10
  ),
  (
    'harta-problemelor-seniorilor',
    'campaign',
    'Harta problemelor seniorilor din comunități',
    'Raportează o problemă concretă din localitatea ta și ajută echipa PCS să o documenteze.',
    'Colectăm semnale despre accesul la servicii medicale, transport, administrație și izolare socială pentru a construi priorități locale verificabile.',
    'national',
    '',
    '',
    NULL,
    '2026-12-15T21:59:59Z',
    'Online și prin organizațiile teritoriale',
    'Fiecare contribuție este direcționată după județ și temă.',
    NULL,
    20
  ),
  (
    'echipa-apeluri-consultare-seniori',
    'volunteer_task',
    'Echipă de apeluri pentru consultarea seniorilor',
    'Alocă două ore pe săptămână pentru discuții ghidate cu seniorii care vor să fie ascultați.',
    'Sarcina include o sesiune scurtă de pregătire, un ghid de conversație și raportarea temelor semnalate, fără colectarea de date sensibile.',
    'online',
    '',
    '',
    NULL,
    NULL,
    'La distanță · program flexibil',
    'Necesar estimat: 20 de voluntari activi.',
    20,
    30
  ),
  (
    'indexare-predictibila-pensii',
    'petition',
    'Petiție pentru indexarea predictibilă a pensiilor',
    'Susține o regulă transparentă de indexare, legată de inflația reală și aplicată la un termen cunoscut.',
    'Semnătura ta susține solicitarea publică PCS pentru protejarea puterii de cumpărare și publicarea formulei de calcul.',
    'national',
    '',
    '',
    NULL,
    '2026-11-30T21:59:59Z',
    'Semnătură online',
    'Numărul de susținători este publicat; datele personale nu sunt afișate.',
    NULL,
    40
  ),
  (
    'prioritati-locale-2027',
    'consultation',
    'Consultare: prioritățile locale pentru 2027',
    'Alege temele urgente pentru județul tău și transmite o propunere concretă organizației teritoriale.',
    'Contribuțiile sunt grupate după județ și domeniu pentru pregătirea agendelor locale și a pozițiilor publice PCS.',
    'national',
    '',
    '',
    NULL,
    '2026-10-31T21:59:59Z',
    'Consultare online',
    'Publicăm o sinteză a priorităților, fără date personale.',
    NULL,
    50
  )
ON CONFLICT (slug) DO UPDATE
SET
  action_type = EXCLUDED.action_type,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  description = EXCLUDED.description,
  scope = EXCLUDED.scope,
  county = EXCLUDED.county,
  locality = EXCLUDED.locality,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  participation_mode = EXCLUDED.participation_mode,
  commitment = EXCLUDED.commitment,
  capacity = EXCLUDED.capacity,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
