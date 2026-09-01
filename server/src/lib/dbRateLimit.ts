import { createHash } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { AppError } from "./errors.js";
import type { ErrorCode } from "./errorCodes.js";

type DbRateLimitOptions = {
  scope: string;
  windowMs: number;
  max: number;
  errorCode: ErrorCode;
  errorMessage: string;
  cleanupAfterMs?: number;
  keyGenerator?: (req: Request) => string;
};

type RateLimitRow = {
  hits: number;
  windowStartMs: string | number | bigint | null;
};

function normalizeKey(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  return normalized || "unknown";
}

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function consumeRateLimit(scope: string, keyHash: string, windowMs: number): Promise<{
  hits: number;
  windowStartMs: number;
}> {
  const nowMs = Date.now();
  const windowStartMs = nowMs - (nowMs % windowMs);

  const result = await prisma.$queryRaw<RateLimitRow[]>(Prisma.sql`
      INSERT INTO rate_limit_entries (
        scope,
        key_hash,
        window_start,
        hits,
        updated_at
      )
      VALUES (
        ${scope},
        ${keyHash},
        to_timestamp(${windowStartMs}::double precision / 1000),
        1,
        NOW()
      )
      ON CONFLICT (scope, key_hash)
      DO UPDATE
      SET
        hits = CASE
          WHEN rate_limit_entries.window_start = EXCLUDED.window_start THEN rate_limit_entries.hits + 1
          ELSE 1
        END,
        window_start = CASE
          WHEN rate_limit_entries.window_start = EXCLUDED.window_start THEN rate_limit_entries.window_start
          ELSE EXCLUDED.window_start
        END,
        updated_at = NOW()
      RETURNING
        hits,
        FLOOR(EXTRACT(EPOCH FROM window_start) * 1000)::bigint AS "windowStartMs"
    `);

  const row = result[0];
  return {
    hits: Number(row?.hits ?? 1),
    windowStartMs: Number(row?.windowStartMs ?? windowStartMs),
  };
}

function cleanupOldRateLimits(cleanupAfterMs: number): void {
  if (Math.random() > 0.01) {
    return;
  }

  void prisma.$executeRaw(Prisma.sql`
      DELETE FROM rate_limit_entries
      WHERE updated_at < NOW() - (${cleanupAfterMs} * INTERVAL '1 millisecond')
    `).catch(() => {
    // Cleanup failures should not block requests.
  });
}

export function createDbRateLimiter(options: DbRateLimitOptions): RequestHandler {
  const cleanupAfterMs = options.cleanupAfterMs ?? 86_400_000;

  return async (req, res, next) => {
    try {
      const keyRaw =
        options.keyGenerator?.(req) ??
        (typeof req.ip === "string" ? req.ip : undefined) ??
        req.socket.remoteAddress ??
        "unknown";
      const keyHash = hashKey(normalizeKey(keyRaw));
      const { hits, windowStartMs } = await consumeRateLimit(options.scope, keyHash, options.windowMs);

      cleanupOldRateLimits(cleanupAfterMs);

      const nowMs = Date.now();
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
