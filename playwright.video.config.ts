import { defineConfig } from "@playwright/test";
import "./load-env";

export default defineConfig({
  testDir: "./tests",
  reporter: [["line"], ["./run-artifacts/test-summary-reporter.js"]],
  timeout: 300_000,
  use: {
    headless: false,
    video: "on",
  },
});
