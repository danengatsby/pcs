#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

: "${TEST_DATABASE_URL:?TEST_DATABASE_URL este obligatoriu pentru E2E full-stack.}"

export NODE_ENV=test
export DATABASE_URL="$TEST_DATABASE_URL"
export AUTH_REFRESH_ENABLED=1
export AUTH_RATE_LIMIT_MAX=1000
export VOLUNTEER_RATE_LIMIT_MAX=1000
# Official Cloudflare Turnstile test pair. Production preflight rejects these values.
export CAPTCHA_MODE=required
export CAPTCHA_SECRET_KEY=1x0000000000000000000000000000000AA
export CAPTCHA_EXPECTED_ACTION=
export CAPTCHA_EXPECTED_HOSTNAME=
export PUBLIC_BASE_URL=
export VITE_CAPTCHA_SITE_KEY=1x00000000000000000000AA
export VITE_CAPTCHA_ACTION=volunteer_signup
export ALLOW_TEST_CAPTCHA_SITE_KEY=1
export EMAIL_NOTIFICATIONS_ENABLED=false
export PORT="${PORT:-4010}"
export CORS_ORIGIN="http://127.0.0.1:$PORT"
export CORS_CREDENTIALS=true

npm run build
node server/dist/scripts/migrateDb.js
playwright test --config=playwright.fullstack.config.ts "$@"
