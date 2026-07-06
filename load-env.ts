// Lightweight .env loader shared by all Playwright configs (avoids a dotenv
// dependency). Importing this module for its side effect populates process.env
// from a local, gitignored .env file. Existing process.env values win.
import * as fs from "fs";
import * as path from "path";

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
