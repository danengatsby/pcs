import type { RequestHandler, Response } from "express";
import {
  readBearerToken,
  verifyAuthToken,
  type AuthTokenPayload,
  type UserRole,
} from "./authToken.js";
import { isTokenRevoked } from "./authTokenRevocation.js";
import { AppError } from "./errors.js";
import { prisma } from "./prisma.js";
import {
  buildAdminAccessContext,
  setAdminAccess,
  type AdminCapability,
} from "./adminAuthorization.js";

export type AuthenticatedUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

type AuthUserRow = AuthenticatedUser;

type LocalsWithAuthUser = {
  authUser?: AuthenticatedUser;
  authToken?: AuthTokenPayload;
};

function setAuthUser(res: Response, user: AuthenticatedUser): void {
  (res.locals as LocalsWithAuthUser).authUser = user;
}

function setAuthToken(res: Response, token: AuthTokenPayload): void {
  (res.locals as LocalsWithAuthUser).authToken = token;
}

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

function parseUserId(rawUserId: string): bigint | null {
  try {
    const userId = BigInt(rawUserId);
    return userId > 0n ? userId : null;
  } catch {
    return null;
  }
}

export function readAuthUser(res: Response): AuthenticatedUser | null {
  const user = (res.locals as LocalsWithAuthUser).authUser;
  return user ?? null;
}

export function readAuthToken(res: Response): AuthTokenPayload | null {
  const token = (res.locals as LocalsWithAuthUser).authToken;
  return token ?? null;
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const bearerToken = readBearerToken(req.header("authorization"));
    if (!bearerToken) {
      next(new AppError(401, "AUTH_UNAUTHORIZED", "Token lipsa sau invalid."));
      return;
    }

    const tokenPayload = await verifyAuthToken(bearerToken);
    if (!tokenPayload) {
      next(new AppError(401, "AUTH_UNAUTHORIZED", "Token lipsa sau invalid."));
      return;
    }

    const tokenRevoked = await isTokenRevoked(tokenPayload.jti);
    if (tokenRevoked) {
      next(new AppError(401, "AUTH_UNAUTHORIZED", "Token lipsa sau invalid."));
      return;
    }

    const userId = parseUserId(tokenPayload.sub);
    if (!userId) {
      next(new AppError(401, "AUTH_UNAUTHORIZED", "Token lipsa sau invalid."));
      return;
    }

    const dbUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      },
    });

    const user: AuthUserRow | null = dbUser
      ? {
        id: dbUser.id.toString(),
        fullName: dbUser.fullName,
        email: dbUser.email,
        role: normalizeRole(dbUser.role),
      }
      : null;

    if (!user) {
      next(new AppError(401, "AUTH_UNAUTHORIZED", "Utilizatorul nu exista."));
      return;
    }

    setAuthUser(res, user);
    setAuthToken(res, tokenPayload);
    next();
  } catch (error) {
    next(error);
  }
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    const user = readAuthUser(res);
    if (!user) {
      next(new AppError(401, "AUTH_UNAUTHORIZED", "Token lipsa sau invalid."));
      return;
    }

    if (!roles.includes(user.role)) {
      next(new AppError(403, "AUTH_FORBIDDEN", "Nu ai permisiunea pentru aceasta actiune."));
      return;
    }

    next();
  };
}

export function requireAdminCapability(capability: AdminCapability): RequestHandler {
  return async (_req, res, next) => {
    const user = readAuthUser(res);
    if (!user) {
      next(new AppError(401, "AUTH_UNAUTHORIZED", "Token lipsa sau invalid."));
      return;
    }

    try {
      const access = await buildAdminAccessContext(user, capability);
      setAdminAccess(res, access);
      next();
    } catch (error) {
      next(error);
    }
  };
}
