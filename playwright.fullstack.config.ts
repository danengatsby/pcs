import { defineConfig } from "@playwright/test";

const appPort = 4010;
const sharedServerEnv =
  "NODE_ENV=test AUTH_REFRESH_ENABLED=1 AUTH_RATE_LIMIT_MAX=1000 VOLUNTEER_RATE_LIMIT_MAX=1000 CAPTCHA_MODE=disabled EMAIL_NOTIFICATIONS_ENABLED=false CORS_ORIGIN=http://127.0.0.1:4010 CORS_CREDENTIALS=true";

export default defineConfig({
  testDir: "./client/tests/e2e",
  testMatch: "**/*.fullstack.spec.ts",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${appPort}`,
    headless: true,
  },
  webServer: {
    command: `${sharedServerEnv} PORT=${appPort} node server/dist/index.js`,
    url: `http://127.0.0.1:${appPort}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
