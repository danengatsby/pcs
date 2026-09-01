import type { NewsMediaKind } from "../types.js";

export function detectMediaKind(mimeType: string): NewsMediaKind {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  return "document";
}

export function parseNewsMediaKind(raw: string, fallback: NewsMediaKind): NewsMediaKind {
  if (raw === "image" || raw === "video" || raw === "document") {
    return raw;
  }

  return fallback;
}
