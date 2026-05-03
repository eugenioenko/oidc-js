import { defineConfig } from "@playwright/test";

const APP_PORT = process.env.E2E_APP_PORT ?? "5173";

export default defineConfig({
  testDir: "./specs",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    headless: true,
  },
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  webServer: {
    command: `pnpm --dir kasper-app dev --port ${APP_PORT}`,
    url: `http://localhost:${APP_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
