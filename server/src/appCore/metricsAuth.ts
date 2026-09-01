import { createHash, timingSafeEqual } from "node:crypto";
import { readBearerToken } from "../lib/authToken.js";
import { env } from "../lib/env.js";
import { incrementRefreshFailure, normalizeRouteLabel } from "../lib/metrics.js";
import { refreshEndpointRoute } from "./paths.js";

type HeaderReadableRequest = {
  header: (name: string) => string | undefined;
};

function tokenDigest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function constantTimeTokenEquals(expected: string, received: string): boolean {
  return timingSafeEqual(tokenDigest(expected), tokenDigest(received));
}

export function isMetricsAuthorized(req: HeaderReadableRequest): boolean {
  const expectedToken = env.metricsBearerToken;
  if (!expectedToken) {
    return true;
  }
  const token = readBearerToken(req.header("authorization"));
  return constantTimeTokenEquals(expectedToken, token ?? "");
}

export function recordRefreshFailure(path: string, code: string): void {
  if (normalizeRouteLabel(path) !== refreshEndpointRoute) {
    return;
  }
  incrementRefreshFailure(code);
}
