import type { Request, RequestHandler } from "express";
import { createHash } from "node:crypto";
import { AppError } from "./errors.js";
import { env } from "./env.js";
import { ensureRedisConnected, getRedisClient } from "./redisClient.js";

import type { ErrorCode } from "./errorCodes.js";

type RedisRateLimitOptions = {
  scope: string;
  windowMs: number;
  max: number;
  errorCode: ErrorCode;
  errorMessage: string;
  keyGenerator?: (req: Request) => string;
};

function normalizeKey(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  return normalized || "unknown";
}

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildWindowStartMs(nowMs: number, windowMs: number): number {
  return nowMs - (nowMs % windowMs);
}

export function createRedisRateLimiter(
  options: RedisRateLimitOptions,
  deps: {
    ensureRedisConnected?: typeof ensureRedisConnected;
    getRedisClient?: typeof getRedisClient;
  } = {}
): RequestHandler {
  const ensureConnected = deps.ensureRedisConnected ?? ensureRedisConnected;
  const getClient = deps.getRedisClient ?? getRedisClient;

  return async (req, res, next) => {
    try {
      await ensureConnected();

      const keyRaw = options.keyGenerator?.(req) ?? req.ip ?? req.socket.remoteAddress ?? "unknown";
      const keyHash = hashKey(normalizeKey(keyRaw));
      const nowMs = Date.now();
      const windowStartMs = buildWindowStartMs(nowMs, options.windowMs);

      const prefix = env.redisKeyPrefix ? `${env.redisKeyPrefix}:` : "";
      const key = `${prefix}rate_limit:${options.scope}:${keyHash}:${windowStartMs}`;

      const client = getClient();

      // Atomic fixed-window counter:
      // - INCR counter
      // - when first hit, set TTL to window length
      const hits = await client
        .multi()
        .incr(key)
        .pexpire(key, options.windowMs)
        .exec()
        .then((result) => {
          const first = result?.[0]?.[1];
          return typeof first === "number" ? first : Number(first ?? 1);
        });

      const resetInMs = Math.max(0, windowStartMs + options.windowMs - nowMs);
      const remaining = Math.max(0, options.max - hits);

      res.setHeader("RateLimit-Limit", String(options.max));
      res.setHeader("RateLimit-Remaining", String(remaining));
      res.setHeader("RateLimit-Reset", String(Math.ceil(resetInMs / 1000)));

      if (hits > options.max) {
        next(new AppError(429, options.errorCode, options.errorMessage));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
