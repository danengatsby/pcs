import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
