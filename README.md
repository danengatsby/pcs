# PCS Platform

Aplicatie full-stack pentru partidul politic PCS, construita cu:

- Node.js API bazat pe Fastify
- PostgreSQL (persistenta date)
- Vite + TypeScript + HTML + CSS (frontend)

## Structura

- `client/` - aplicatia Vite (interfata publica PCS)
- `server/` - API Node.js + scripturi DB
- `server/sql/` - schema si seed SQL

Backend-ul urmeaza acum o structura orientata pe domenii:
- `server/src/modules/auth`
- `server/src/modules/news`
- `server/src/modules/volunteers`
- `server/src/modules/members`
- `server/src/modules/admin`
- `server/src/modules/stats`
- `server/src/shared` (config/middleware/utils/types)

## API Routing

- Endpoint-urile API sunt declarate exclusiv in `server/src/appCore/apiRouteRegistry.ts`.
- Express si Fastify consuma acelasi registry; paritatea intre adaptoare nu se mentine manual in fisiere separate.
- Nu se mai adauga `express.Router()` noi pentru `/api/**`.
- Detalii si regula de extindere: `docs/api-routing.md`

## Cerinte

- Node.js 20+
- npm 10+
- PostgreSQL 15+ (sau Docker)

## Tooling (strict)

- Lint strict pe frontend (`.ts` + `.tsx`) si backend.
- Reguli minime obligatorii: `curly`, `eqeqeq`, `@typescript-eslint/no-explicit-any`.
- `no-console` este interzis in codul de aplicatie (exceptie scripturi operationale din `server/src/scripts`).


Comenzi:

```bash
npm run lint
npm run db:check-schema
npm run verify
npm run test:smoke
```

`npm run test:smoke` ruleaza build-ul si apoi smoke tests pe artefactul compilat pentru frontend (HTML + bundle JavaScript), `health`, `auth`, `members` si `admin volunteers`.
In CI, dupa `npm run build`, se foloseste `npm run test:smoke:compiled`.
Testele care modifica baza de date necesita `TEST_DATABASE_URL`; numele bazei trebuie sa contina segmentul `test` sau `testing`.

## Setup rapid

1. Porneste baza de date (Docker):

```bash
docker compose up -d postgres
```

2. Creeaza fisierul de mediu:

```bash
cp server/.env.example server/.env
```

Configuratia implicita foloseste PostgreSQL pe `localhost:5433` (port mapat din container).
In productie (`NODE_ENV=production`), cookie-urile de refresh auth sunt fortate cu atributul `Secure`.

Optional, pentru override-uri Docker Compose la nivel de host ports:

```bash
cp .env.example .env
```

Implicit, `GRAFANA_PORT=3300` pentru a evita conflictul cu alte servicii locale de pe `3000`.

3. Instaleaza dependintele:

```bash
npm install
```

4. Initializeaza schema si date demo:

```bash
npm run db:init
npm run db:seed
```

5. Ruleaza in development:

```bash
npm run dev
```

Aplicatia frontend: `http://localhost:5173`
API backend: `http://localhost:4000/api/health`
Documentatie API: `http://localhost:4000/api-docs/`

Endpoint nou pentru registru members:
- `GET /api/members?search=&status=&limit=&offset=`

Module de domeniu noi (enterprise scaffolding):
- `GET /api/finance`
- `GET /api/organizations`
- `GET /api/elections`

Health endpoints (enterprise):
- `GET /api/health/live` - liveness probe
- `GET /api/health/ready` - readiness probe (DB + runtime drain state)
- `GET /api/health` - raport extins (runtime + build + dependinte)

## Build + productie

```bash
npm run build
npm run start
```

Local, serverul Node serveste fisierele frontend din `client/dist`. Deploy-ul de productie construieste fiecare frontend intr-un release imutabil din `.releases/client` si il selecteaza prin `CLIENT_DIST_PATH` numai la restartul PM2.
Buildul de productie necesita `VITE_CAPTCHA_SITE_KEY` real in `server/.env`; preflight-ul si Vite opresc release-ul daca valoarea lipseste sau este placeholder. Serverul necesita
`CAPTCHA_MODE=required` si `CAPTCHA_SECRET_KEY`.

Hardening build output activ:
- frontend curata `client/dist` la fiecare build local (`emptyOutDir: true`)
- deploy-ul de productie nu construieste direct in directorul frontend servit
- `npm run build:client:production` transfera numai configuratia publica `VITE_CAPTCHA_*` din `server/.env` catre Vite
- frontend fara source maps (`sourcemap: false`)
- backend curata `server/dist` inainte de compilare

Metadata release/build (optional, recomandat in productie):
- `APP_NAME`
- `APP_VERSION`
- `APP_RELEASE`
- `APP_COMMIT_SHA`
- `APP_BUILD_TIME` (ISO-8601)

## Politica Auth (TTL + Refresh)

- `POST /api/auth/signup` raspunde uniform (aceeasi forma de raspuns pentru email nou sau existent) pentru a reduce enumerarea conturilor.
- `AUTH_TOKEN_TTL_SECONDS` controleaza TTL-ul access token.
- `AUTH_REFRESH_ENABLED=true` activeaza refresh token pe cookie `HttpOnly`.
- `AUTH_REFRESH_TTL_SECONDS` trebuie sa fie strict mai mare decat `AUTH_TOKEN_TTL_SECONDS`.
- Refresh token-ul este rotit la fiecare `POST /api/auth/refresh` si necesita header CSRF (`x-csrf-token`).
- Politica efectiva poate fi citita din `GET /api/auth/policy` (`tokenPolicy`).

## Observabilitate (Metrici + Alerte)

- Endpoint metrici Prometheus: `GET /api/metrics`.
- Activare: `METRICS_ENABLED` (implicit `true` in development/test, `false` in production).
- In productie, daca `METRICS_ENABLED=true`, `METRICS_BEARER_TOKEN` este obligatoriu.
- Metrici expuse:
  - `pcs_http_request_duration_seconds` (histogram latență API)
  - `pcs_auth_failures_total` (failures autentificare)
  - `pcs_auth_refresh_failures_total` (failures refresh token)
  - `pcs_email_failures_total` (failures trimitere emailuri)
- Reguli de alerta Prometheus: `monitoring/prometheus/alerts.pcs.yml`.
- Template scrape config Prometheus: `monitoring/prometheus/prometheus.pcs.example.yml`.
- Config local Prometheus (docker compose): `monitoring/prometheus/prometheus.local.yml`.
- Ghid setup productie: `monitoring/prometheus/README.md`.

## PM2 (optional)

```bash
npm run deploy:production
```

Procesul PM2 pentru acest repo este `pcs-server`.
Aplicatia citeste configuratia din `server/.env`.
Workerii PM2 separati sunt `pcs-email-outbox-worker` si `pcs-admin-audit-outbox-worker`.
Pentru configurarea production folosește `server/.env.production.example`; scriptul de deploy ruleaza preflight-ul, construieste un release frontend nou si face restartul obligatoriu cu mediul actualizat.
Host-ul de deploy trebuie sa aiba Chromium Playwright instalat; smoke-ul final deschide pagina reala si valideaza titlul si CTA-ul principal.

E2E-ul full-stack pentru aderare foloseste perechea oficiala de test Turnstile, porneste serverul cu CAPTCHA obligatoriu si verifica tokenul, raspunsul `201` si inregistrarea din baza de test. Necesita `TEST_DATABASE_URL` explicit.

## Runbook productie

Runbook operational complet:

- `docs/runbook.production.md`
- `docs/api-routing.md`

## Mentenanta

Curata token-urile auth expirate (refresh + revoke list):

```bash
npm run auth:cleanup-tokens
```

Proceseaza batch-ul de email notifications din outbox (cu retry):

```bash
npm run email:outbox-worker
```

In productie, ruleaza periodic acest worker (cron/systemd/PM2 cron) pentru livrare continua a notificarilor email.
