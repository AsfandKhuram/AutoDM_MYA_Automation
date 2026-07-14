import { defineConfig } from "@playwright/test";
import "./load-env";

export default defineConfig({
  testDir: "./AutoDM-Prefi",
  testMatch: ["**/*.{spec,test,spec-prod,spec-stage}.ts", "**/*.spec_DEV.ts", "**/*.spec OP.ts", "**/AutoDM_Prefi_Coborrower*.ts"],
  testIgnore: ["**/DMX-loan_AutoDM prefi_flow.spec.ts", "**/DMX-QHloan-creation.stage.spec.ts"],
  reporter: [["line"], ["./run-artifacts/test-summary-reporter.js"]],
  timeout: 420_000,
  use: {
    headless: false,
    video: "on",
    actionTimeout: 25_000,
    navigationTimeout: 60_000,
  },
});
