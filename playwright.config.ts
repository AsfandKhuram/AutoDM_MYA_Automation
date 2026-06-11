import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./AutoDM-Prefi",
  testMatch: ["**/*.{spec,test,spec-prod}.ts"],
  testIgnore: ["**/DMX-loan_AutoDM prefi_flow.spec.ts"],
  timeout: 240_000,
  use: {
    headless: false,
    video: "on",
    actionTimeout: 25_000,
    navigationTimeout: 60_000,
  },
});
