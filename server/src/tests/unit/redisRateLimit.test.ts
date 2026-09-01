import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import type { Redis } from "ioredis";
import { createRedisRateLimiter } from "../../lib/redisRateLimit.js";

// Minimal in-memory mock for ioredis methods used by the limiter.
function createMockRedis(hits: number) {
  return {
    multi() {
      return {
        incr() {
          return this;
        },
        pexpire() {
          return this;
        },
        async exec() {
          // ioredis multi exec returns: Array<[Error | null, any]>
          return [
            [null, hits],
            [null, 1],
          ];
        },
      };
    },
  };
}

test("createRedisRateLimiter sets headers and allows when under limit", async () => {
  const limiter = createRedisRateLimiter(
    {
      scope: "unit",
      windowMs: 60_000,
      max: 3,
      errorCode: "RATE_LIMITED",
      errorMessage: "Too many",
    },
    {
      ensureRedisConnected: async () => undefined,
      getRedisClient: () => createMockRedis(2) as unknown as Redis,
    }
  );

  const headers: Record<string, string> = {};
  const req = { ip: "1.2.3.4", socket: { remoteAddress: "1.2.3.4" } } as unknown as Request;
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
  } as unknown as Response;

  let calledNext = false;
  const next: NextFunction = (err?: unknown) => {
    if (err) {throw err;}
    calledNext = true;
  };

  await limiter(req, res, next);

  assert.equal(calledNext, true);
  assert.equal(headers["RateLimit-Limit"], "3");
  assert.equal(headers["RateLimit-Remaining"], "1");
  assert.ok(Number(headers["RateLimit-Reset"]) >= 0);
});

test("createRedisRateLimiter blocks when over limit", async () => {
  const limiter = createRedisRateLimiter(
    {
      scope: "unit",
      windowMs: 60_000,
      max: 3,
      errorCode: "RATE_LIMITED",
      errorMessage: "Too many",
    },
    {
      ensureRedisConnected: async () => undefined,
      getRedisClient: () => createMockRedis(4) as unknown as Redis,
    }
  );

  const req = { ip: "1.2.3.4", socket: { remoteAddress: "1.2.3.4" } } as unknown as Request;
  const res = { setHeader: () => undefined } as unknown as Response;

  let receivedError: unknown;
  const next: NextFunction = (err?: unknown) => {
    receivedError = err;
  };

  await limiter(req, res, next);

  assert.ok(receivedError, "expected an error");
});
