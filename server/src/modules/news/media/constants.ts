import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const uploadsRootDir = path.resolve(currentDir, "../../../../uploads");

export const newsUploadsDir = path.resolve(uploadsRootDir, "news");

const maxMediaFileBytesRaw = process.env.NEWS_MEDIA_MAX_FILE_BYTES?.trim();
const maxMediaFileBytesParsed = maxMediaFileBytesRaw ? Number(maxMediaFileBytesRaw) : NaN;
export const maxMediaFileBytes = Number.isFinite(maxMediaFileBytesParsed) && maxMediaFileBytesParsed > 0
  ? Math.floor(maxMediaFileBytesParsed)
  : 15 * 1024 * 1024;

export const mimeExtensionMap = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"],
  ["application/pdf", ".pdf"],
]);

export const mimeAllowedOriginalExtensions = new Map<string, Set<string>>([
  ["image/jpeg", new Set([".jpg", ".jpeg"])],
  ["image/png", new Set([".png"])],
  ["image/webp", new Set([".webp"])],
  ["image/gif", new Set([".gif"])],
  ["video/mp4", new Set([".mp4"])],
  ["video/webm", new Set([".webm"])],
  ["video/quicktime", new Set([".mov"])],
  ["application/pdf", new Set([".pdf"])],
]);

export function resolveUploadsRootDir(): string {
  return uploadsRootDir;
}
