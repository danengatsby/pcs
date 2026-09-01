import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type BuildInfo = {
  appName: string;
  appVersion: string;
  appRelease: string;
  commitSha: string;
  buildTime: string;
  nodeVersion: string;
};

function readPackageVersion(): string {
  try {
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(currentFile);
    const packagePath = path.resolve(currentDir, "../../package.json");
    const raw = readFileSync(packagePath, "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };

    if (typeof parsed.version === "string" && parsed.version.trim()) {
      return parsed.version.trim();
    }
  } catch {
    // Keep fallback value.
  }

  return "0.0.0";
}

function readBuildTime(): string {
  const raw = process.env.APP_BUILD_TIME?.trim();
  if (!raw) {
    return "";
  }

  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return "";
  }

  return new Date(parsed).toISOString();
}

export const packageVersion = readPackageVersion();

export const buildInfo: BuildInfo = {
  appName: process.env.APP_NAME?.trim() || "pcp-api",
  appVersion: process.env.APP_VERSION?.trim() || packageVersion,
  appRelease: process.env.APP_RELEASE?.trim() || "enterprise-modernized",
  commitSha: process.env.APP_COMMIT_SHA?.trim() || "",
  buildTime: readBuildTime(),
  nodeVersion: process.version,
};
