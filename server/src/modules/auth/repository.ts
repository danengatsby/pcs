import type { UserRole } from "../../lib/authToken.js";
import { prisma } from "../../lib/prisma.js";
import type { UserAuthRow, UserPublicRow } from "./types.js";

function isUserRole(value: string): value is UserRole {
  return (
    value === "SUSTINATOR"
    || value === "ADERENT"
    || value === "MEMBRU"
    || value === "CONSILIER"
    || value === "SECRETAR"
    || value === "VICEPRESEDINTE"
    || value === "PRESEDINTE"
  );
}

function normalizeRole(rawRole: string): UserRole {
  return isUserRole(rawRole) ? rawRole : "ADERENT";
}

function isDuplicateKeyError(error: unknown): boolean {
  if (
    typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "P2002"
  ) {
    return true;
  }

  if (error instanceof Error) {
    return /duplicate key value violates unique constraint|23505|unique constraint failed/i.test(error.message);
  }

  return false;
}

export async function findUserForSignin(email: string): Promise<UserAuthRow | null> {
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    orderBy: {
      id: "desc",
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: normalizeRole(user.role),
    passwordHash: user.passwordHash,
  };
}

export async function insertSignupUser(input: {
  fullName: string;
  email: string;
  passwordHash: string;
}): Promise<UserPublicRow | null> {
  try {
    const created = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        passwordHash: input.passwordHash,
        role: "ADERENT",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      },
    });

    return {
      id: created.id.toString(),
      fullName: created.fullName,
      email: created.email,
      role: normalizeRole(created.role),
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return null;
    }

    throw error;
  }
}
