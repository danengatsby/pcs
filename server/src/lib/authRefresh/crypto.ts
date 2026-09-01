import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashOpaqueToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createOpaqueToken(byteLength: number): string {
  return randomBytes(byteLength).toString("base64url");
}

export function normalizeText(value: string | undefined, maxLength: number): string {
  if (!value) {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

export function constantTimeHashEquals(expectedHash: string | null, currentHash: string): boolean {
  if (!expectedHash || expectedHash.length !== currentHash.length) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedHash, "utf8");
  const currentBuffer = Buffer.from(currentHash, "utf8");
  return timingSafeEqual(expectedBuffer, currentBuffer);
}
