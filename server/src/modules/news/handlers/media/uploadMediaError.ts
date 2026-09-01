import { AppError } from "../../../../lib/errors.js";
import { maxMediaFileBytes } from "../../media.js";

export function mapUploadMediaError(error: unknown): AppError {
  const maybeError = error as { message?: unknown; code?: unknown };
  const message = typeof maybeError.message === "string" ? maybeError.message : "";
  const code = maybeError.code;

  if (
    code === "LIMIT_FILE_SIZE" ||
    message.includes("maxFileSize") ||
    message.includes("options.maxTotalFileSize")
  ) {
    return new AppError(
      400,
      "NEWS_MEDIA_FILE_TOO_LARGE",
      `Fisierul depaseste limita maxima de ${Math.floor(maxMediaFileBytes / (1024 * 1024))}MB.`
    );
  }

  if (error instanceof AppError) {
    return error;
  }

  return new AppError(400, "NEWS_MEDIA_UPLOAD_INVALID", "Nu am putut procesa upload-ul media.");
}
