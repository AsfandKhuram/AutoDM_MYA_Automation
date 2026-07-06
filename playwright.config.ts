import { defineConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Lightweight .env loader (avoids a dotenv dependency). Reads KEY=VALUE lines
// from a local, gitignored .env file and populates process.env for the specs.
(() => {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
})();

export default defineConfig({
  testDir: "./AutoDM-Prefi",
  testMatch: ["**/*.{spec,test,spec-prod,spec-stage}.ts", "**/*.spec_DEV.ts", "**/*.spec OP.ts", "**/AutoDM_Prefi_Coborrower.ts"],
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
