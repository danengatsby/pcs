import { createRequire } from "node:module";
import type { Request } from "express";
import { AppError } from "../../../lib/errors.js";
import { isAllowedUploadMimeType, normalizeUploadMimeType } from "../../../lib/mediaMime.js";
import { maxMediaFileBytes } from "./constants.js";
import type { MultipartParseResult, UploadedFile } from "../types.js";

type FormidableFactory = (options: {
  multiples?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  filter?: (part: { mimetype?: string | null }) => boolean;
}) => {
  parse: (
    req: Request,
    cb: (
      error: Error | null,
      fields: Record<string, unknown>,
      files: Record<string, unknown>
    ) => void
  ) => void;
};

const requireModule = createRequire(import.meta.url);
const formidableModule = requireModule("formidable") as {
  default?: FormidableFactory;
} | FormidableFactory;
const formidableFactory: FormidableFactory = typeof formidableModule === "function"
  ? formidableModule
  : (formidableModule.default as FormidableFactory);

function isUploadedFile(value: unknown): value is UploadedFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "filepath" in value &&
    typeof (value as { filepath?: unknown }).filepath === "string" &&
    "size" in value &&
    typeof (value as { size?: unknown }).size === "number"
  );
}

function pickSingleFile(files: Record<string, unknown>): UploadedFile | null {
  const candidate = files.file;
  if (isUploadedFile(candidate)) {
    return candidate;
  }

  if (Array.isArray(candidate) && isUploadedFile(candidate[0])) {
    return candidate[0];
  }

  return null;
}

export async function parseMultipartUpload(req: Request): Promise<MultipartParseResult> {
  const form = formidableFactory({
    multiples: false,
    maxFiles: 1,
    maxFileSize: maxMediaFileBytes,
    filter: ({ mimetype }: { mimetype?: string | null }) => {
      const normalized = normalizeUploadMimeType(mimetype ?? "");
      return Boolean(normalized && isAllowedUploadMimeType(normalized));
    },
  });

  const { fields, files } = await new Promise<{
    fields: Record<string, unknown>;
    files: Record<string, unknown>;
  }>((resolve, reject) => {
    form.parse(req, (
      error: Error | null,
      parsedFields: Record<string, unknown>,
      parsedFiles: Record<string, unknown>
    ) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        fields: parsedFields,
        files: parsedFiles,
      });
    });
  });

  const file = pickSingleFile(files);
  if (!file) {
    throw new AppError(400, "NEWS_MEDIA_FILE_MISSING", "Fisierul media lipseste.");
  }

  return {
    fields,
    file,
  };
}
