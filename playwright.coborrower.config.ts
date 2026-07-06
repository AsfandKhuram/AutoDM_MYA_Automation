import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./AutoDM-Prefi",
  testMatch: ["**/AutoDM_Prefi_Coborrower.ts", "**/DMX-loan-creation.spec OP.ts"],
  reporter: [["line"], ["./run-artifacts/test-summary-reporter.js"]],
  timeout: 420_000,
  use: {
    headless: false,
    actionTimeout: 25000,
    navigationTimeout: 60000,
  },
});
