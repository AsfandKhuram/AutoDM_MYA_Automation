import { defineConfig } from "@playwright/test";
import "./load-env";

export default defineConfig({
  testDir: "./AutoDM-Prefi/DEV/AutoDM",
  testMatch: ["DMX-loan-creation.spec OP.ts"],
  reporter: [["line"], ["./run-artifacts/test-summary-reporter.js"]],
  timeout: 240_000,
  use: {
    headless: false,
    video: "on",
    actionTimeout: 25_000,
    navigationTimeout: 60_000,
  },
});
