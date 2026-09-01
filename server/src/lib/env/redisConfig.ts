import { readPositiveInt } from "./shared.js";

export function readRedisUrl(): string {
  return process.env.REDIS_URL?.trim() ?? "";
}

export function readRedisKeyPrefix(): string {
  const raw = process.env.REDIS_KEY_PREFIX?.trim() ?? "pcp";
  return raw || "pcp";
}

export function readRedisConnectTimeoutMs(): number {
  const raw = process.env.REDIS_CONNECT_TIMEOUT_MS?.trim() ?? "3000";
  return readPositiveInt(raw, "REDIS_CONNECT_TIMEOUT_MS");
}
