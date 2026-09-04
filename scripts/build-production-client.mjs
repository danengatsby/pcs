import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = process.env.PRODUCTION_ENV_FILE?.trim() || path.join(root, "server", ".env");
const fileValues = parse(await fs.readFile(envPath, "utf8"));

function readPublicBuildValue(name, fallback = "") {
  return process.env[name]?.trim() || fileValues[name]?.trim() || fallback;
}

const captchaSiteKey = readPublicBuildValue("VITE_CAPTCHA_SITE_KEY");
if (!captchaSiteKey) {
  throw new Error(`VITE_CAPTCHA_SITE_KEY lipsește din ${envPath}.`);
}

const child = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  [
    "run",
    "build",
    "--workspace",
    "client",
    "--",
    "--mode",
    "production",
    ...process.argv.slice(2),
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      VITE_CAPTCHA_SITE_KEY: captchaSiteKey,
      VITE_CAPTCHA_ACTION: readPublicBuildValue("VITE_CAPTCHA_ACTION", "volunteer_signup"),
    },
    stdio: "inherit",
  },
);

const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => resolve(code ?? 1));
});

if (exitCode !== 0) {
  process.exitCode = exitCode;
}
