#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

: "${TEST_DATABASE_URL:?TEST_DATABASE_URL este obligatoriu pentru E2E full-stack.}"

export NODE_ENV=test
export DATABASE_URL="$TEST_DATABASE_URL"
export AUTH_REFRESH_ENABLED=1
export AUTH_RATE_LIMIT_MAX=1000
export VOLUNTEER_RATE_LIMIT_MAX=1000
export PUBLIC_BASE_URL=
export EMAIL_NOTIFICATIONS_ENABLED=false
export PORT="${PORT:-4010}"
export CORS_ORIGIN="http://127.0.0.1:$PORT"
export CORS_CREDENTIALS=true

npm run build
node server/dist/scripts/migrateDb.js
playwright test --config=playwright.fullstack.config.ts "$@"
