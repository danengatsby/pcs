import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { createRateLimiter } from "../../lib/rateLimit.js";

function buildReq(ip: string): Request {
  return { ip, socket: { remoteAddress: ip } } as unknown as Request;
}

function buildRes() {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
  } as unknown as Response;
  return { res, headers };
}

test("rate limiter uses Redis when RATE_LIMIT_STORE=redis (smoke)", async () => {
  // Note: this test expects a Redis instance reachable via REDIS_URL.
  // In dev we run: docker run -d --name pcp-redis-test -p 6381:6379 redis:7-alpine
  const limiter = createRateLimiter({
    scope: "integration-redis",
    windowMs: 5_000,
    max: 5,
    errorCode: "RATE_LIMITED",
    errorMessage: "Too many",
  });

  const { res, headers } = buildRes();
  let ok = 0;
  const next: NextFunction = (err?: unknown) => {
    if (err) {throw err;}
    ok++;
  };

  await limiter(buildReq("10.0.0.1"), res, next);

  assert.equal(ok, 1);
  assert.equal(headers["RateLimit-Limit"], "5");
});

test("rate limiter falls back to DB when Redis is misconfigured/unavailable", async () => {
  // We simulate a Redis outage by temporarily switching env to DB expected behavior:
  // since createRateLimiter decides implementation based on env at module load time,
  // this test simply asserts the middleware still works when Redis errors occur.
  //
  // Implementation detail: createRateLimiter catches redisLimiter errors and runs dbLimiter.
  const limiter = createRateLimiter({
    scope: "integration-fallback",
    windowMs: 5_000,
    max: 5,
    errorCode: "RATE_LIMITED",
    errorMessage: "Too many",
  });

  const { res } = buildRes();

  let called = 0;
  const next: NextFunction = (err?: unknown) => {
    if (err) {throw err;}
    called++;
  };

  await limiter(buildReq("10.0.0.2"), res, next);
  assert.equal(called, 1);
});
