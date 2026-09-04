import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const defaultClientDistPath = path.resolve(currentDir, "../../../client/dist");

export function resolveClientDistPath(configuredPath = process.env.CLIENT_DIST_PATH): string {
  const normalizedPath = configuredPath?.trim();
  return normalizedPath ? path.resolve(normalizedPath) : defaultClientDistPath;
}
