import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "../../../../lib/errors.js";
import {
  detectMimeTypeFromFile,
  isAllowedUploadMimeType,
  normalizeUploadMimeType,
} from "../../../../lib/mediaMime.js";
import {
  detectMediaKind,
  parseNewsMediaKind,
} from "../../parsing.js";
import {
  mimeAllowedOriginalExtensions,
  mimeExtensionMap,
  normalizeFilenameExtension,
  readFormField,
  resolveStoredPath,
} from "../../media.js";
import type { MultipartParseResult, NewsMediaKind, UploadedFile } from "../../types.js";

export type PreparedUploadMediaInput = {
  file: UploadedFile;
  kind: NewsMediaKind;
  title: string;
  alt: string;
  mimeType: string;
  storagePath: string;
  destinationPath: string;
  publicUrl: string;
  originalName: string;
};

export async function prepareUploadMediaInput(parsedUpload: MultipartParseResult): Promise<PreparedUploadMediaInput> {
  const file = parsedUpload.file;
  const mimetypeRaw = typeof file.mimetype === "string" ? file.mimetype : "";
  const declaredMimeType = normalizeUploadMimeType(mimetypeRaw.trim());

  if (!declaredMimeType || !isAllowedUploadMimeType(declaredMimeType)) {
    throw new AppError(400, "NEWS_MEDIA_TYPE_INVALID", "Tipul fisierului nu este permis.");
  }

  const detectedMimeType = await detectMimeTypeFromFile(file.filepath);
  if (!detectedMimeType || !isAllowedUploadMimeType(detectedMimeType)) {
    throw new AppError(400, "NEWS_MEDIA_CONTENT_INVALID", "Continutul fisierului media este invalid.");
  }

  if (declaredMimeType !== detectedMimeType) {
    throw new AppError(
      400,
      "NEWS_MEDIA_TYPE_MISMATCH",
      "Tipul real al fisierului nu corespunde tipului declarat."
    );
  }

  const mimeType = detectedMimeType;
  const inferredKind = detectMediaKind(mimeType);
  const kind = parseNewsMediaKind(readFormField(parsedUpload.fields, "kind").toLowerCase(), inferredKind);
  const title = readFormField(parsedUpload.fields, "title").slice(0, 180);
  const alt = readFormField(parsedUpload.fields, "alt").slice(0, 240);

  const originalFilenameRaw = typeof file.originalFilename === "string" ? file.originalFilename : "";
  const originalExtension = normalizeFilenameExtension(path.extname(originalFilenameRaw));
  if (originalExtension) {
    const allowedOriginalExtensions = mimeAllowedOriginalExtensions.get(mimeType);
    if (!allowedOriginalExtensions || !allowedOriginalExtensions.has(originalExtension)) {
      throw new AppError(
        400,
        "NEWS_MEDIA_EXTENSION_INVALID",
        "Extensia fisierului nu este permisa pentru tipul media detectat."
      );
    }
  }

  const extension = mimeExtensionMap.get(mimeType);
  if (!extension) {
    throw new AppError(400, "NEWS_MEDIA_EXTENSION_MISSING", "Extensia media nu poate fi determinata.");
  }

  const generatedFilename = `${Date.now()}-${randomUUID()}${extension}`;
  const storagePath = path.join("news", generatedFilename).replaceAll("\\", "/");

  return {
    file,
    kind,
    title,
    alt,
    mimeType,
    storagePath,
    destinationPath: resolveStoredPath(storagePath),
    publicUrl: `/uploads/news/${generatedFilename}`,
    originalName: (originalFilenameRaw || generatedFilename).slice(0, 255),
  };
}
