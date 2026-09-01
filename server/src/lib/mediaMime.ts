import { open } from "node:fs/promises";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
]);

const mimeAliases = new Map<string, string>([
  ["image/jpg", "image/jpeg"],
  ["video/quicktime", "video/quicktime"],
]);

const signatureReadBytes = 512;

function startsWithBytes(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) {
    return false;
  }

  for (let index = 0; index < bytes.length; index += 1) {
    if (buffer[offset + index] !== bytes[index]) {
      return false;
    }
  }

  return true;
}

function hasAsciiAt(buffer: Buffer, offset: number, value: string): boolean {
  if (buffer.length < offset + value.length) {
    return false;
  }
  return buffer.subarray(offset, offset + value.length).toString("ascii") === value;
}

export function normalizeUploadMimeType(rawValue: string): string {
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  return mimeAliases.get(normalized) ?? normalized;
}

export function isAllowedUploadMimeType(mimeType: string): boolean {
  return allowedMimeTypes.has(normalizeUploadMimeType(mimeType));
}

export function detectMimeTypeFromSignature(signature: Buffer): string | null {
  if (startsWithBytes(signature, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (startsWithBytes(signature, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (hasAsciiAt(signature, 0, "GIF87a") || hasAsciiAt(signature, 0, "GIF89a")) {
    return "image/gif";
  }

  if (hasAsciiAt(signature, 0, "RIFF") && hasAsciiAt(signature, 8, "WEBP")) {
    return "image/webp";
  }

  if (hasAsciiAt(signature, 0, "%PDF-")) {
    return "application/pdf";
  }

  if (hasAsciiAt(signature, 4, "ftyp")) {
    const majorBrand = signature.subarray(8, 12).toString("ascii");
    if (majorBrand.startsWith("qt")) {
      return "video/quicktime";
    }
    return "video/mp4";
  }

  if (startsWithBytes(signature, [0x1a, 0x45, 0xdf, 0xa3])) {
    return "video/webm";
  }

  return null;
}

export async function detectMimeTypeFromFile(filePath: string): Promise<string | null> {
  const fileHandle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(signatureReadBytes);
    const { bytesRead } = await fileHandle.read(buffer, 0, signatureReadBytes, 0);
    if (bytesRead <= 0) {
      return null;
    }

    return detectMimeTypeFromSignature(buffer.subarray(0, bytesRead));
  } finally {
    await fileHandle.close();
  }
}
