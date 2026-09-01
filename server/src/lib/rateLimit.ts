import type { RequestHandler } from "express";
import { env } from "./env.js";
import { appLogger } from "./logger.js";
import { createDbRateLimiter } from "./dbRateLimit.js";
import { createRedisRateLimiter } from "./redisRateLimit.js";
import type { ErrorCode } from "./errorCodes.js";

type RateLimiterOptions = {
  scope: string;
  windowMs: number;
  max: number;
  errorCode: ErrorCode;
  errorMessage: string;
  cleanupAfterMs?: number;
  keyGenerator?: (req: Parameters<RequestHandler>[0]) => string;
};

/**
 * Facade rate limiter: prefers Redis when configured, but falls back to DB on errors.
 *
 * Notes:
 * - fallback is evaluated per-request (so Redis outages don't break auth/volunteer flows).
 * - for Redis we keep a fixed-window counter with TTL.
 * - for DB we keep the existing UPSERT approach + occasional cleanup.
 */
export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const dbLimiter = createDbRateLimiter({
    scope: options.scope,
    windowMs: options.windowMs,
    max: options.max,
    errorCode: options.errorCode,
    errorMessage: options.errorMessage,
    cleanupAfterMs: options.cleanupAfterMs,
    keyGenerator: options.keyGenerator,
  });

  if (env.rateLimitStore !== "redis") {
    return dbLimiter;
  }

  const redisLimiter = createRedisRateLimiter({
    scope: options.scope,
    windowMs: options.windowMs,
    max: options.max,
    errorCode: options.errorCode,
    errorMessage: options.errorMessage,
    keyGenerator: options.keyGenerator,
  });

  return async (req, res, next) => {
    try {
      await redisLimiter(req, res, next);
    } catch (error) {
      appLogger.warn(
        {
          err: error,
          scope: options.scope,
        },
        "rate_limit_fallback"
      );
      await dbLimiter(req, res, next);
    }
  };
}
