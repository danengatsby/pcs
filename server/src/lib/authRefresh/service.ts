import { env } from "../env.js";
import { prisma } from "../prisma.js";
import { ensureRedisConnected } from "../redisClient.js";
import {
  constantTimeHashEquals,
  createOpaqueToken,
  hashOpaqueToken,
  normalizeText,
} from "./crypto.js";
import {
  claimRefreshTokenForRotation,
  deleteExpiredRefreshTokens,
  insertRefreshTokenRow,
  insertRotatedRefreshToken,
  lookupRefreshTokenForUpdate,
  revokeAndLinkRefreshToken,
  revokeAllRefreshTokensForUser,
  revokeRefreshTokenByHash,
  revokeRefreshTokenById,
} from "./repository.js";
import {
  deleteExpiredRefreshTokensRedis,
  insertRefreshTokenRedisRow,
  revokeAllRefreshTokensRedisForUser,
  revokeRefreshTokenRedisByHash,
  rotateRefreshTokenRedisSession,
} from "./repositoryRedis.js";
import type {
  RefreshSessionUserSnapshot,
  RefreshTokenSession,
  RotatedRefreshSession,
} from "./types.js";

function usesRedisRefreshStore(): boolean {
  return env.authRefreshEnabled && env.authRefreshStore === "redis";
}

export async function createRefreshTokenSession(input: {
  userId: string | number | bigint;
  user?: RefreshSessionUserSnapshot;
  userAgent?: string;
  ipAddress?: string;
}): Promise<RefreshTokenSession | null> {
  if (!env.authRefreshEnabled) {
    return null;
  }

  const token = createOpaqueToken(48);
  const csrfToken = createOpaqueToken(24);
  const tokenHash = hashOpaqueToken(token);
  const csrfTokenHash = hashOpaqueToken(csrfToken);

  if (usesRedisRefreshStore()) {
    const user = input.user;
    if (!user) {
      throw new Error("Session refresh redis necesita profil utilizator complet la creare.");
    }

    await ensureRedisConnected();
    await insertRefreshTokenRedisRow({
      tokenHash,
      csrfTokenHash,
      user: {
        id: String(input.userId),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      refreshTtlSeconds: env.authRefreshTtlSeconds,
      userAgent: normalizeText(input.userAgent, 255),
      ipAddress: normalizeText(input.ipAddress, 120),
    });
  } else {
    await insertRefreshTokenRow({
      tokenHash,
      csrfTokenHash,
      userId: input.userId,
      refreshTtlSeconds: env.authRefreshTtlSeconds,
      userAgent: normalizeText(input.userAgent, 255),
      ipAddress: normalizeText(input.ipAddress, 120),
    });
  }

  return {
    token,
    csrfToken,
    expiresInSeconds: env.authRefreshTtlSeconds,
  };
}

export async function revokeAllRefreshTokenSessionsForUser(userId: string | number | bigint): Promise<number> {
  if (!env.authRefreshEnabled) {
    return 0;
  }

  if (usesRedisRefreshStore()) {
    await ensureRedisConnected();
    return revokeAllRefreshTokensRedisForUser(userId);
  }

  return revokeAllRefreshTokensForUser(userId);
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  if (!env.authRefreshEnabled) {
    return;
  }

  const token = rawToken.trim();
  if (!token) {
    return;
  }

  const tokenHash = hashOpaqueToken(token);
  if (usesRedisRefreshStore()) {
    await ensureRedisConnected();
    await revokeRefreshTokenRedisByHash(tokenHash);
    return;
  }

  await revokeRefreshTokenByHash(tokenHash);
}

export async function rotateRefreshTokenSession(
  rawToken: string,
  rawCsrfToken: string,
  meta: {
    userAgent?: string;
    ipAddress?: string;
  } = {}
): Promise<RotatedRefreshSession | null> {
  if (!env.authRefreshEnabled) {
    return null;
  }

  const token = rawToken.trim();
  const csrfToken = rawCsrfToken.trim();
  if (!token || !csrfToken) {
    return null;
  }

  const tokenHash = hashOpaqueToken(token);
  const csrfTokenHash = hashOpaqueToken(csrfToken);

  if (usesRedisRefreshStore()) {
    await ensureRedisConnected();

    const newToken = createOpaqueToken(48);
    const newCsrfToken = createOpaqueToken(24);
    const user = await rotateRefreshTokenRedisSession({
      tokenHash,
      csrfTokenHash,
      refreshTtlSeconds: env.authRefreshTtlSeconds,
      userAgent: normalizeText(meta.userAgent, 255),
      ipAddress: normalizeText(meta.ipAddress, 120),
      newTokenHash: hashOpaqueToken(newToken),
      newCsrfTokenHash: hashOpaqueToken(newCsrfToken),
    });

    if (!user) {
      return null;
    }

    return {
      user,
      session: {
        token: newToken,
        csrfToken: newCsrfToken,
        expiresInSeconds: env.authRefreshTtlSeconds,
      },
    };
  }

  return prisma.$transaction(async (tx) => {
    const row = await lookupRefreshTokenForUpdate(tokenHash, tx);
    if (!row) {
      return null;
    }

    if (row.revokedAt || Date.parse(row.expiresAt) <= Date.now()) {
      await revokeRefreshTokenById(row.id, tx);
      return null;
    }

    if (!constantTimeHashEquals(row.csrfTokenHash, csrfTokenHash)) {
      await revokeRefreshTokenById(row.id, tx);
      return null;
    }

    const claimed = await claimRefreshTokenForRotation({
      refreshTokenId: row.id,
      csrfTokenHash,
      runner: tx,
    });
    if (!claimed) {
      return null;
    }

    const newToken = createOpaqueToken(48);
    const newCsrfToken = createOpaqueToken(24);
    const newTokenHash = hashOpaqueToken(newToken);
    const newCsrfTokenHash = hashOpaqueToken(newCsrfToken);

    const newRowId = await insertRotatedRefreshToken({
      tokenHash: newTokenHash,
      csrfTokenHash: newCsrfTokenHash,
      userId: row.userId,
      refreshTtlSeconds: env.authRefreshTtlSeconds,
      rotatedFromId: row.id,
      userAgent: normalizeText(meta.userAgent, 255),
      ipAddress: normalizeText(meta.ipAddress, 120),
      runner: tx,
    });

    if (!newRowId) {
      return null;
    }

    await revokeAndLinkRefreshToken({
      currentId: row.id,
      nextId: newRowId,
      runner: tx,
    });

    return {
      user: {
        id: row.userId,
        fullName: row.fullName,
        email: row.email,
        role: row.role,
      },
      session: {
        token: newToken,
        csrfToken: newCsrfToken,
        expiresInSeconds: env.authRefreshTtlSeconds,
      },
    };
  });
}

export async function cleanupExpiredRefreshTokenSessions(limit = 5000): Promise<number> {
  const batchLimit = Number.isInteger(limit) && limit > 0 ? limit : 5000;

  if (usesRedisRefreshStore()) {
    return deleteExpiredRefreshTokensRedis();
  }

  return deleteExpiredRefreshTokens(batchLimit);
}
