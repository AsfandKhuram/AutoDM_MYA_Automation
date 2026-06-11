import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["DMX-loan-creation.onQef.ts"],
  timeout: 240_000,
  use: {
    headless: false,
    video: "on",
    actionTimeout: 25_000,
    navigationTimeout: 60_000,
  },
});
