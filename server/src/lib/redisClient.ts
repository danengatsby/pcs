import { Redis } from "ioredis";
import { env } from "./env.js";
import { appLogger } from "./logger.js";

let redisClient: Redis | null = null;

function shouldUseRedis(): boolean {
  return env.rateLimitStore === "redis" || (env.authRefreshEnabled && env.authRefreshStore === "redis");
}

export function getRedisClient(): Redis {
  if (!shouldUseRedis()) {
    throw new Error("Redis client solicitat cand nici RATE_LIMIT_STORE si nici AUTH_REFRESH_STORE nu sunt redis.");
  }

  if (redisClient) {
    return redisClient;
  }

  const client = new Redis(env.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: env.redisConnectTimeoutMs,
  });

  client.on("error", (error: unknown) => {
    appLogger.error({ err: error }, "Eroare Redis client.");
  });

  redisClient = client;
  return client;
}

export async function ensureRedisConnected(): Promise<void> {
  if (!shouldUseRedis()) {
    return;
  }

  const client = getRedisClient();
  if (client.status === "ready" || client.status === "connect") {
    return;
  }

  await client.connect();
}

export async function closeRedisClient(): Promise<void> {
  if (!redisClient) {
    return;
  }

  try {
    await redisClient.quit();
  } catch {
    redisClient.disconnect();
  } finally {
    redisClient = null;
  }
}
