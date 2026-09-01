import { prisma } from "./prisma.js";

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const row = await prisma.authRevokedToken.findFirst({
    where: {
      jti,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      jti: true,
    },
  });

  return Boolean(row);
}

export async function revokeToken(payload: { jti: string; exp: number }): Promise<void> {
  const nextExpiresAt = new Date(payload.exp * 1000);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.authRevokedToken.findUnique({
      where: {
        jti: payload.jti,
      },
      select: {
        expiresAt: true,
      },
    });

    if (!existing) {
      await tx.authRevokedToken.create({
        data: {
          jti: payload.jti,
          expiresAt: nextExpiresAt,
          revokedAt: new Date(),
        },
      });
      return;
    }

    await tx.authRevokedToken.update({
      where: {
        jti: payload.jti,
      },
      data: {
        expiresAt: existing.expiresAt > nextExpiresAt ? existing.expiresAt : nextExpiresAt,
        revokedAt: new Date(),
      },
    });
  });
}

export async function cleanupExpiredRevokedTokens(limit = 5000): Promise<number> {
  const batchLimit = Number.isInteger(limit) && limit > 0 ? limit : 5000;
  const staleRows = await prisma.authRevokedToken.findMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
    orderBy: {
      expiresAt: "asc",
    },
    take: batchLimit,
    select: {
      jti: true,
    },
  });

  if (staleRows.length === 0) {
    return 0;
  }

  const deleted = await prisma.authRevokedToken.deleteMany({
    where: {
      jti: {
        in: staleRows.map((row) => row.jti),
      },
    },
  });

  return deleted.count;
}
