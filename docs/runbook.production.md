# PCS Production Runbook

Acest runbook standardizeaza release-ul pentru productie cu aceeasi ordine folosita in CI: build predictibil, smoke compilat pe artefactul rezultat, apoi deploy + verificari post-release.

## 1) Pre-deploy checks

Preconditii:
- `server/.env` actualizat pentru mediul tinta
- `CAPTCHA_MODE=required`, `CAPTCHA_SECRET_KEY` pe server si `VITE_CAPTCHA_SITE_KEY` in mediul buildului frontend
- `NEWS_MEDIA_CLAMAV_ENABLED=1`, `NEWS_MEDIA_CLAMAV_MODE=clamd` si profilul Docker `production` pornit pentru serviciul ClamAV
- `server/.env.production.example` copiat ca `server/.env` și completat cu valori reale
- Chromium pentru Playwright instalat pe host (`npx playwright install --with-deps chromium`, o singura data sau dupa actualizari Playwright)
- `TEST_DATABASE_URL` exportat catre o baza dedicata, cu `test` sau `testing` in nume
- backup/snapshot DB recent daca release-ul contine migrari SQL

Ruleaza local sau in CI pe un mediu non-productie:

```bash
npm ci
npm run lint
npm run build
npm run test:smoke:compiled
npm run test:integration
```

Criterii minime:
- lint fara warnings/errors
- build client + server verde
- smoke compilat verde
- integration tests verzi

Note:
- `npm run test:smoke:compiled` ruleaza pe artefactul deja compilat din `server/dist` si valideaza inclusiv HTML-ul public, bundle-ul JavaScript referit de acesta, `health`, `auth basic`, `members` si `admin volunteers`.
- smoke-ul compilat creeaza date temporare de test; nu il rula pe baza de date de productie.

## 2) Build output hardening policy

Reguli active in proiect:
- buildurile locale folosesc `client/dist`; deploy-ul de productie nu scrie in directorul servit
- fiecare deploy construieste frontend-ul intr-un director nou `.releases/client/<release-id>` si porneste API-ul cu `CLIENT_DIST_PATH` setat la acel director imutabil
- procesul PM2 este repornit obligatoriu dupa build, cu `--update-env`
- frontend nu publica source maps (`sourcemap: false`)
- backend curata `server/dist` inainte de compilare (`rm -rf dist && tsc`)

Scop: reducere artefacte stale, reducere expunere cod sursa si output determinist la release.

## 3) Deploy steps (PM2)

Pe host-ul de productie:

```bash
cd /var/www/pcs
npm ci
cp server/.env.production.example server/.env # doar la prima configurare; păstrează valorile existente ulterior
npm run deploy:production
```

Ordine importanta:
- migrarea ruleaza dupa build si inainte de restart
- scriptul de migrari este forward-only si executa smoke checks DB dupa aplicare
- `npm run db:seed` nu se ruleaza in productie
- `pcs-server`, `pcs-email-outbox-worker` si `pcs-admin-audit-outbox-worker` sunt procese PM2 separate; workerii nu ruleaza in procesul API
- `npm run predeploy` verifică secretele obligatorii, alinierea PM2/Docker/aplicație și răspunsul `PONG` al `clamd`
- `npm run deploy:production` execută aceeași secvență reproductibilă: ClamAV, preflight, build într-un release imutabil, migrații, restart PM2 și smoke checks
- dupa smoke-ul bundle-ului, deploy-ul ruleaza Playwright contra instantei repornite si cere titlul public plus CTA-ul principal
- nu rula `npm run build --workspace client` direct peste directorul indicat de `CLIENT_DIST_PATH`
- configuratia PM2 seteaza explicit `NODE_ENV=production`; aplicatia trebuie sa porneasca fail-closed daca lipsesc secretele sau CAPTCHA obligatoriu

## 4) Smoke test post-deploy

Verificari API:

```bash
curl -fsS http://127.0.0.1:4000/api/health/live
curl -fsS http://127.0.0.1:4000/api/health/ready
curl -fsSI http://127.0.0.1:4000/api-docs/
curl -fsS http://127.0.0.1:4000/api-docs.json | head -c 200
```

Verificari frontend public:

```bash
html="$(curl -fsS https://pcpens.online/)"
bundle="$(printf '%s' "$html" | sed -nE 's@.*src="(/assets/[^"]+\.js)".*@\1@p' | head -n 1)"
curl -fsS -o /dev/null -w '%{content_type}\n' "https://pcpens.online$bundle"
curl -fsS -o /dev/null -w '%{http_code}\n' https://pcpens.online/assets/does-not-exist.js
curl -fsSI https://pcpens.online/manifest_pcs.html
curl -fsSI https://pcpens.online/admin/volunteers
```

Bundle-ul trebuie sa raspunda cu `application/javascript`, iar asset-ul inexistent cu `404`, niciodata cu HTML-ul SPA.

Verificarea browser poate fi reluata separat cu:

```bash
PCS_SMOKE_BASE_URL=https://pcpens.online npm run test:synthetic:public
```

Verificari functionale manuale:
- login admin
- admin members: cautare / filtre de baza
- admin volunteers: filtre (`county/locality/skills`), `Incarca mai multi`, `Edit`, `Salveaza`, `Export CSV`
- signup aderenti (flux complet + mesaj succes)

## 5) Observability checks

```bash
curl -fsS http://127.0.0.1:4000/api/metrics -H "Authorization: Bearer <METRICS_BEARER_TOKEN>" | head
```

Verifica in Grafana dashboard:
- p95 latency
- auth failures
- refresh failures
- email failures

## 6) Rollback

Atentie:
- migrarile SQL sunt forward-only; un rollback doar de cod este sigur numai daca versiunea anterioara ramane compatibila cu schema deja migrata
- daca release-ul a introdus schema incompatibila, rollback-ul real cere restore din backup/snapshot DB sau un forward-fix rapid

Rollback minim (schema compatibila):
1. identifica release-ul frontend anterior din `.releases/client`
2. revino la commit-ul sau artefactul server anterior stabil si compileaza serverul daca este necesar
3. reporneste cu `CLIENT_DIST_PATH=/cale/absoluta/.releases/client/<release-id-anterior> pm2 startOrRestart ecosystem.config.cjs --update-env`
4. ruleaza `pm2 save` si smoke tests din sectiunea 4

Rollback complet (schema incompatibila):
1. opreste traficul sau blocheaza write-urile
2. restaureaza snapshot-ul DB corespunzator release-ului anterior
3. redeployeaza artefactul anterior
4. reruleaza smoke tests din sectiunea 4

Nota:
- `server/.env` trebuie sa respecte validarile de productie, inclusiv `CAPTCHA_MODE=required` si cheia Turnstile corespunzatoare frontend-ului

## 7) Incident notes

La incident, documenteaza minim:
- timestamp UTC
- commit/release (`APP_RELEASE`, `APP_COMMIT_SHA`)
- simptom
- endpoint afectat
- actiune de mitigare
