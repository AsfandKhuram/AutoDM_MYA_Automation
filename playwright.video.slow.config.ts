import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 300_000,
  use: {
    headless: false,
    video: "on",
    launchOptions: {
      slowMo: 500,
    },
  },
  workers: 1,
});
