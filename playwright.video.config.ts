import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  reporter: [["line"], ["./run-artifacts/test-summary-reporter.js"]],
  timeout: 300_000,
  use: {
    headless: false,
    video: "on",
  },
});
