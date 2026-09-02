#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

readonly clamav_container="pcs-clamav"
readonly api_url="http://127.0.0.1:${PORT:-4000}"

log() {
  printf '[deploy] %s\n' "$1"
}

fail() {
  printf '[deploy] ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Comanda lipsă: $1"
}

start_clamav() {
  if docker compose version >/dev/null 2>&1; then
    log "Pornesc ClamAV prin Docker Compose v2."
    docker compose --profile production up -d clamav
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    log "Pornesc ClamAV prin docker-compose legacy."
    docker-compose --profile production up -d clamav
    return
  fi

  log "Compose nu este disponibil; pornesc containerul ClamAV direct."
  if docker ps --format '{{.Names}}' | grep -qx "$clamav_container"; then
    return
  fi
  if docker ps -a --format '{{.Names}}' | grep -qx "$clamav_container"; then
    docker start "$clamav_container" >/dev/null
    return
  fi

  docker run -d \
    --name "$clamav_container" \
    --restart unless-stopped \
    -p 127.0.0.1:3310:3310 \
    -v pcs_clamav_db:/var/lib/clamav \
    --health-cmd='clamdscan --ping 1' \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=10 \
    --health-start-period=60s \
    clamav/clamav:stable >/dev/null
}

wait_for_clamav() {
  log "Aștept ClamAV healthy."
  for attempt in $(seq 1 60); do
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$clamav_container" 2>/dev/null || true)
    if [[ "$status" == "healthy" || "$status" == "running" ]]; then
      return
    fi
    if [[ "$status" == "unhealthy" ]]; then
      docker logs --tail 40 "$clamav_container" >&2 || true
      fail "ClamAV este unhealthy."
    fi
    sleep 5
  done
  docker logs --tail 40 "$clamav_container" >&2 || true
  fail "Timeout la pornirea ClamAV."
}

smoke_check() {
  local path="$1"
  curl --fail --silent --show-error --max-time 10 "$api_url$path" >/dev/null
}

wait_for_api() {
  log "Aștept API ready."
  for attempt in $(seq 1 30); do
    if smoke_check "/api/health/ready"; then
      return
    fi
    sleep 2
  done
  fail "API-ul nu a devenit ready în timpul așteptat."
}

require_command docker
require_command npm
require_command curl
require_command pm2

[[ -f server/.env ]] || fail "Lipsește server/.env. Folosește server/.env.production.example ca model."

log "Pornesc ClamAV."
start_clamav
wait_for_clamav

log "Rulez preflight-ul production."
npm run predeploy

log "Construiesc artefactele."
npm run build

log "Aplic migrațiile DB."
NODE_ENV=production node server/dist/scripts/migrateDb.js

log "Reporneasc API-ul și workerii."
NEWS_MEDIA_CLAMAV_ENABLED=1 \
NEWS_MEDIA_CLAMAV_MODE=clamd \
NEWS_MEDIA_CLAMD_HOST=127.0.0.1 \
NEWS_MEDIA_CLAMD_PORT=3310 \
NODE_ENV=production pm2 startOrRestart ecosystem.config.cjs
pm2 save >/dev/null

log "Rulez smoke checks."
wait_for_api
for path in /api/health/live /api/health/ready /api-docs.json; do
  smoke_check "$path"
done

log "Deploy production finalizat."
