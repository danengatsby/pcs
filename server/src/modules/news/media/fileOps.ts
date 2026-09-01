import path from "node:path";
import { copyFile, mkdir, rename, unlink } from "node:fs/promises";
import { AppError } from "../../../lib/errors.js";
import { newsUploadsDir, resolveUploadsRootDir } from "./constants.js";

export function normalizeFilenameExtension(raw: string): string {
  if (!raw.startsWith(".")) {
    return "";
  }

  const sanitized = raw.toLowerCase().replace(/[^a-z0-9.]/g, "");
  if (!sanitized || sanitized === ".") {
    return "";
  }

  return sanitized;
}

export function resolveStoredPath(storagePath: string): string {
  const absolutePath = path.resolve(resolveUploadsRootDir(), storagePath);
  if (!absolutePath.startsWith(newsUploadsDir + path.sep)) {
    throw new AppError(500, "MEDIA_STORAGE_PATH_INVALID", "Calea media este invalida.");
  }

  return absolutePath;
}

export async function moveFileSafe(sourcePath: string, targetPath: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });

  try {
    await rename(sourcePath, targetPath);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "EXDEV") {
      throw error;
    }

    await copyFile(sourcePath, targetPath);
    await unlink(sourcePath);
  }
}
