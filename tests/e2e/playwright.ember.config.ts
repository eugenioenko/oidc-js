import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
  },
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  webServer: {
    command: "pnpm --dir ember-app dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
