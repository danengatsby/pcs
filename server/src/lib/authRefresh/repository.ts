import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { RefreshTokenLookupRow } from "./types.js";

type IdInput = string | number | bigint;

function toBigInt(value: IdInput): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(Math.trunc(value));
  }

  return BigInt(value);
}

function mapLookupRow(row: {
  id: bigint;
  userId: bigint;
  expiresAt: Date;
  revokedAt: Date | null;
  csrfTokenHash: string;
  user: {
    fullName: string;
    email: string;
    role: string;
  };
}): RefreshTokenLookupRow {
  return {
    id: row.id.toString(),
    userId: row.userId.toString(),
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    csrfTokenHash: row.csrfTokenHash,
    fullName: row.user.fullName,
    email: row.user.email,
    role: row.user.role as RefreshTokenLookupRow["role"],
  };
}

type PrismaRunner = Prisma.TransactionClient;

function readRunner(runner?: PrismaRunner): PrismaRunner | typeof prisma {
  return runner ?? prisma;
}

export async function insertRefreshTokenRow(input: {
  tokenHash: string;
  csrfTokenHash: string;
  userId: IdInput;
  refreshTtlSeconds: number;
  userAgent: string;
  ipAddress: string;
  runner?: PrismaRunner;
}): Promise<void> {
  const db = readRunner(input.runner);
  await db.authRefreshToken.create({
    data: {
      tokenHash: input.tokenHash,
      csrfTokenHash: input.csrfTokenHash,
      userId: toBigInt(input.userId),
      expiresAt: new Date(Date.now() + (input.refreshTtlSeconds * 1000)),
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    },
    select: {
      id: true,
    },
  });
}

export async function revokeRefreshTokenByHash(tokenHash: string): Promise<void> {
  await prisma.authRefreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function lookupRefreshTokenForUpdate(
  tokenHash: string,
  runner: PrismaRunner
): Promise<RefreshTokenLookupRow | null> {
  const row = await runner.authRefreshToken.findUnique({
    where: {
      tokenHash,
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      csrfTokenHash: true,
      user: {
        select: {
          fullName: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  return mapLookupRow(row);
}

export async function revokeRefreshTokenById(
  refreshTokenId: IdInput,
  runner: PrismaRunner
): Promise<void> {
  await runner.authRefreshToken.updateMany({
    where: {
      id: toBigInt(refreshTokenId),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function claimRefreshTokenForRotation(input: {
  refreshTokenId: IdInput;
  csrfTokenHash: string;
  runner: PrismaRunner;
}): Promise<boolean> {
  const result = await input.runner.authRefreshToken.updateMany({
    where: {
      id: toBigInt(input.refreshTokenId),
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
      csrfTokenHash: input.csrfTokenHash,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return result.count === 1;
}

export async function insertRotatedRefreshToken(input: {
  tokenHash: string;
  csrfTokenHash: string;
  userId: IdInput;
  refreshTtlSeconds: number;
  rotatedFromId: IdInput;
  userAgent: string;
  ipAddress: string;
  runner: PrismaRunner;
}): Promise<string | null> {
  const row = await input.runner.authRefreshToken.create({
    data: {
      tokenHash: input.tokenHash,
      csrfTokenHash: input.csrfTokenHash,
      userId: toBigInt(input.userId),
      expiresAt: new Date(Date.now() + (input.refreshTtlSeconds * 1000)),
      rotatedFromId: toBigInt(input.rotatedFromId),
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    },
    select: {
      id: true,
    },
  });

  return row.id.toString();
}

export async function revokeAndLinkRefreshToken(input: {
  currentId: IdInput;
  nextId: IdInput;
  runner: PrismaRunner;
}): Promise<void> {
  await input.runner.authRefreshToken.update({
    where: {
      id: toBigInt(input.currentId),
    },
    data: {
      revokedAt: new Date(),
      rotatedToId: toBigInt(input.nextId),
    },
    select: {
      id: true,
    },
  });
}

export async function revokeAllRefreshTokensForUser(userId: IdInput): Promise<number> {
  const result = await prisma.authRefreshToken.updateMany({
    where: {
      userId: toBigInt(userId),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return result.count;
}

export async function deleteExpiredRefreshTokens(limit: number): Promise<number> {
  const staleRows = await prisma.authRefreshToken.findMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
    orderBy: [
      { expiresAt: "asc" },
      { id: "asc" },
    ],
    take: limit,
    select: {
      id: true,
    },
  });

  if (staleRows.length === 0) {
    return 0;
  }

  const deleted = await prisma.authRefreshToken.deleteMany({
    where: {
      id: {
        in: staleRows.map((row) => row.id),
      },
    },
  });

  return deleted.count;
}
