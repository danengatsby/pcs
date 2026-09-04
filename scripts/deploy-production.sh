#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

readonly clamav_container="pcs-clamav"
readonly api_url="http://127.0.0.1:${PORT:-4000}"
readonly repository_root="$(pwd -P)"
readonly release_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
readonly client_release_dir="$repository_root/.releases/client/$release_id"

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

extract_frontend_entry() {
  sed -nE 's@.*src="(/assets/[^"]+\.js)".*@\1@p' | head -n 1
}

validate_client_release() {
  local entry_asset

  [[ -f "$client_release_dir/index.html" ]] || fail "Release-ul client nu conține index.html."
  entry_asset="$(extract_frontend_entry < "$client_release_dir/index.html")"
  [[ -n "$entry_asset" ]] || fail "index.html nu indică bundle-ul JavaScript principal."
  [[ -f "$client_release_dir$entry_asset" ]] || fail "Bundle absent din release: $entry_asset"
}

smoke_check_frontend() {
  local frontend_html
  local entry_asset
  local content_type
  local missing_asset_result
  local missing_asset_status
  local missing_asset_content_type

  frontend_html="$(curl --fail --silent --show-error --max-time 10 "$api_url/")"
  entry_asset="$(printf '%s' "$frontend_html" | extract_frontend_entry)"
  [[ -n "$entry_asset" ]] || fail "HTML-ul public nu indică bundle-ul JavaScript principal."

  content_type="$(
    curl --fail --silent --show-error --max-time 10 \
      --output /dev/null \
      --write-out '%{content_type}' \
      "$api_url$entry_asset"
  )"

  [[ "${content_type,,}" == application/javascript* ]] || \
    fail "Bundle-ul $entry_asset are Content-Type '$content_type', nu application/javascript."

  missing_asset_result="$(
    curl --silent --show-error --max-time 10 \
      --output /dev/null \
      --write-out '%{http_code} %{content_type}' \
      "$api_url/assets/__pcs_missing_$release_id.js"
  )"
  read -r missing_asset_status missing_asset_content_type <<< "$missing_asset_result"
  [[ "$missing_asset_status" == "404" ]] || \
    fail "Un asset inexistent a răspuns cu HTTP $missing_asset_status, nu 404."
  [[ "${missing_asset_content_type,,}" != text/html* ]] || \
    fail "Un asset inexistent a primit eronat fallback-ul HTML al aplicației."
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

log "Construiesc serverul."
npm run build --workspace server

log "Construiesc clientul într-un release imutabil: $client_release_dir"
mkdir -p "$client_release_dir"
npm run build:client:production -- --outDir "$client_release_dir" --emptyOutDir
validate_client_release

log "Aplic migrațiile DB."
NODE_ENV=production node server/dist/scripts/migrateDb.js

log "Reporneasc obligatoriu API-ul și workerii pe noul release."
NEWS_MEDIA_CLAMAV_ENABLED=1 \
NEWS_MEDIA_CLAMAV_MODE=clamd \
NEWS_MEDIA_CLAMD_HOST=127.0.0.1 \
NEWS_MEDIA_CLAMD_PORT=3310 \
CLIENT_DIST_PATH="$client_release_dir" \
NODE_ENV=production pm2 startOrRestart ecosystem.config.cjs --update-env

log "Rulez smoke checks."
wait_for_api
for path in /api/health/live /api/health/ready /api-docs.json; do
  smoke_check "$path"
done
smoke_check_frontend

log "Rulez testul sintetic în browser pentru pagina publică."
PCS_SMOKE_BASE_URL="$api_url" npm run test:synthetic:public
pm2 save >/dev/null

log "Deploy production finalizat cu release-ul client $release_id."
