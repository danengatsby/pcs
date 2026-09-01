# PCP Platform

Aplicatie full-stack pentru partidul politic PCP, construita cu:

- Node.js API cu adaptoare Express + Fastify
- PostgreSQL (persistenta date)
- Vite + TypeScript + HTML + CSS (frontend)

## Structura

- `client/` - aplicatia Vite (interfata publica PCP)
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
npm run verify
npm run test:smoke
```

`npm run test:smoke` ruleaza build-ul si apoi smoke tests pe artefactul compilat pentru `health`, `auth`, `members` si `admin volunteers`.
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

In productie, serverul Node serveste si fisierele frontend din `client/dist`.
Buildul de productie necesita `VITE_CAPTCHA_SITE_KEY`; serverul necesita
`CAPTCHA_MODE=required` si `CAPTCHA_SECRET_KEY`.

Hardening build output activ:
- frontend curata `client/dist` la fiecare build (`emptyOutDir: true`)
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
  - `pcp_http_request_duration_seconds` (histogram latență API)
  - `pcp_auth_failures_total` (failures autentificare)
  - `pcp_auth_refresh_failures_total` (failures refresh token)
  - `pcp_email_failures_total` (failures trimitere emailuri)
- Reguli de alerta Prometheus: `monitoring/prometheus/alerts.pcp.yml`.
- Template scrape config Prometheus: `monitoring/prometheus/prometheus.pcp.example.yml`.
- Config local Prometheus (docker compose): `monitoring/prometheus/prometheus.local.yml`.
- Ghid setup productie: `monitoring/prometheus/README.md`.

## PM2 (optional)

```bash
npm run build
pm2 startOrRestart ecosystem.config.cjs
pm2 save
```

Procesul PM2 pentru acest repo este `pcp-server`.
Aplicatia citeste configuratia din `server/.env`.

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
