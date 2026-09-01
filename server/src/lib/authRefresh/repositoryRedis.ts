import type { UserRole } from "../authToken.js";
import { env } from "../env.js";
import { getRedisClient } from "../redisClient.js";
import { constantTimeHashEquals } from "./crypto.js";
import type { RefreshSessionUser } from "./types.js";

type IdInput = string | number | bigint;

type RefreshRedisRecord = {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  csrfTokenHash: string;
  expiresAtMs: number;
  revokedAtMs: number | null;
};

function sessionKey(tokenHash: string): string {
  return `${env.redisKeyPrefix}:auth:refresh:${tokenHash}`;
}

function userSessionSetKey(userId: string): string {
  return `${env.redisKeyPrefix}:auth:refresh:user:${userId}`;
}

function normalizeUserId(userId: IdInput): string {
  return typeof userId === "string" ? userId : String(userId);
}

function parseNullableInt(rawValue: string | undefined): number | null {
  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function parseRequiredInt(rawValue: string | undefined): number {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseRecord(raw: Record<string, string>): RefreshRedisRecord | null {
  if (Object.keys(raw).length === 0) {
    return null;
  }

  const role = raw.role;
  const expiresAtMs = parseRequiredInt(raw.expiresAtMs);
  if (
    !raw.userId
    || !raw.fullName
    || !raw.email
    || !raw.csrfTokenHash
    || !role
    || !Number.isFinite(expiresAtMs)
  ) {
    return null;
  }

  if (
    role !== "SUSTINATOR"
    && role !== "ADERENT"
    && role !== "MEMBRU"
    && role !== "CONSILIER"
    && role !== "SECRETAR"
    && role !== "VICEPRESEDINTE"
    && role !== "PRESEDINTE"
  ) {
    return null;
  }

  return {
    userId: raw.userId,
    fullName: raw.fullName,
    email: raw.email,
    role,
    csrfTokenHash: raw.csrfTokenHash,
    expiresAtMs,
    revokedAtMs: parseNullableInt(raw.revokedAtMs),
  };
}

export async function insertRefreshTokenRedisRow(input: {
  tokenHash: string;
  csrfTokenHash: string;
  user: RefreshSessionUser;
  refreshTtlSeconds: number;
  userAgent: string;
  ipAddress: string;
}): Promise<void> {
  const redis = getRedisClient();
  const key = sessionKey(input.tokenHash);
  const userKey = userSessionSetKey(input.user.id);
  const now = Date.now();
  const expiresAtMs = now + (input.refreshTtlSeconds * 1000);

  await redis
    .multi()
    .hmset(key, {
      userId: input.user.id,
      fullName: input.user.fullName,
      email: input.user.email,
      role: input.user.role,
      csrfTokenHash: input.csrfTokenHash,
      createdAtMs: String(now),
      expiresAtMs: String(expiresAtMs),
      revokedAtMs: "",
      rotatedFromHash: "",
      rotatedToHash: "",
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    })
    .pexpireat(key, expiresAtMs)
    .sadd(userKey, input.tokenHash)
    .pexpireat(userKey, expiresAtMs)
    .exec();
}

export async function revokeRefreshTokenRedisByHash(tokenHash: string): Promise<void> {
  const redis = getRedisClient();
  const key = sessionKey(tokenHash);
  const userId = await redis.hget(key, "userId");
  if (!userId) {
    return;
  }

  await redis
    .multi()
    .hset(key, "revokedAtMs", String(Date.now()))
    .srem(userSessionSetKey(userId), tokenHash)
    .exec();
}

export async function revokeAllRefreshTokensRedisForUser(userId: IdInput): Promise<number> {
  const redis = getRedisClient();
  const normalizedUserId = normalizeUserId(userId);
  const activeUserSessionsKey = userSessionSetKey(normalizedUserId);
  const tokenHashes = await redis.smembers(activeUserSessionsKey);

  if (tokenHashes.length === 0) {
    await redis.del(activeUserSessionsKey);
    return 0;
  }

  const result = await redis
    .multi()
    .del(...tokenHashes.map((tokenHash) => sessionKey(tokenHash)))
    .del(activeUserSessionsKey)
    .exec();

  if (!result) {
    return 0;
  }

  const deletedSessions = result[0]?.[1];
  return typeof deletedSessions === "number" ? deletedSessions : 0;
}

export async function rotateRefreshTokenRedisSession(input: {
  tokenHash: string;
  csrfTokenHash: string;
  refreshTtlSeconds: number;
  userAgent: string;
  ipAddress: string;
  newTokenHash: string;
  newCsrfTokenHash: string;
}): Promise<RefreshSessionUser | null> {
  const redis = getRedisClient();
  const currentKey = sessionKey(input.tokenHash);
  const now = Date.now();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await redis.watch(currentKey);
    const parsed = parseRecord(await redis.hgetall(currentKey));
    if (!parsed) {
      await redis.unwatch();
      return null;
    }

    if (
      parsed.revokedAtMs !== null
      || parsed.expiresAtMs <= now
      || !constantTimeHashEquals(parsed.csrfTokenHash, input.csrfTokenHash)
    ) {
      const activeUserSessionsKey = userSessionSetKey(parsed.userId);
      await redis
        .multi()
        .hset(currentKey, "revokedAtMs", String(now))
        .srem(activeUserSessionsKey, input.tokenHash)
        .exec();
      return null;
    }

    const newKey = sessionKey(input.newTokenHash);
    const activeUserSessionsKey = userSessionSetKey(parsed.userId);
    const newExpiresAtMs = now + (input.refreshTtlSeconds * 1000);

    const transaction = redis
      .multi()
      .hmset(newKey, {
        userId: parsed.userId,
        fullName: parsed.fullName,
        email: parsed.email,
        role: parsed.role,
        csrfTokenHash: input.newCsrfTokenHash,
        createdAtMs: String(now),
        expiresAtMs: String(newExpiresAtMs),
        revokedAtMs: "",
        rotatedFromHash: input.tokenHash,
        rotatedToHash: "",
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      })
      .pexpireat(newKey, newExpiresAtMs)
      .hmset(currentKey, {
        revokedAtMs: String(now),
        rotatedToHash: input.newTokenHash,
      })
      .sadd(activeUserSessionsKey, input.newTokenHash)
      .srem(activeUserSessionsKey, input.tokenHash)
      .pexpireat(activeUserSessionsKey, newExpiresAtMs);

    const committed = await transaction.exec();
    if (committed === null) {
      continue;
    }

    return {
      id: parsed.userId,
      fullName: parsed.fullName,
      email: parsed.email,
      role: parsed.role,
    };
  }

  return null;
}

export async function deleteExpiredRefreshTokensRedis(): Promise<number> {
  return 0;
}
