import { defineConfig } from "@playwright/test";

const appPort = 4174;

export default defineConfig({
  testDir: "./client/tests/e2e",
  testMatch: "public-home.fullstack.spec.ts",
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${appPort}`,
    headless: true,
  },
  webServer: {
    command: `npm run preview --workspace client -- --host 127.0.0.1 --port ${appPort}`,
    url: `http://127.0.0.1:${appPort}`,
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
