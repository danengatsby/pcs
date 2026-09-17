import type { NextFunction, Request, Response } from "express";
import { createAuthToken } from "../../../lib/authToken.js";
import { revokeRefreshToken, rotateRefreshTokenSession } from "../../../lib/authRefreshToken.js";
import { adminAccessTokenLifetimeSeconds, isAdminRole, rotateAdminSession } from "../../../lib/adminMfa.js";
import { AppError } from "../../../lib/errors.js";
import { env } from "../../../lib/env.js";
import { sendSuccess } from "../../../lib/http.js";
import {
  clearRefreshCookies,
  readRefreshCookie,
  readRefreshCsrfCookie,
  readRefreshCsrfHeader,
  setRefreshCookies,
} from "../cookies.js";
import { buildAuthTokenPolicy, readExpiryIso } from "../policy.js";
import { readClientIp, readUserAgent } from "../requestContext.js";
import { sanitizeUser } from "../user.js";
import { prisma } from "../../../lib/prisma.js";
import type { UserRole } from "../../../lib/authToken.js";
import { isPublicAdminUser } from "../../../lib/adminPublicAccess.js";

export async function refreshHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!env.authRefreshEnabled) {
    next(new AppError(404, "AUTH_REFRESH_DISABLED", "Refresh token este dezactivat."));
    return;
  }

  const refreshToken = readRefreshCookie(req);
  if (!refreshToken) {
    clearRefreshCookies(res);
    next(new AppError(401, "AUTH_UNAUTHORIZED", "Refresh token lipsa sau invalid."));
    return;
  }

  const csrfCookie = readRefreshCsrfCookie(req);
  const csrfHeader = readRefreshCsrfHeader(req);
  if (!csrfCookie || !csrfHeader) {
    next(new AppError(400, "AUTH_CSRF_MISSING", "Token CSRF lipsa pentru refresh."));
    return;
  }
  if (csrfCookie !== csrfHeader) {
    next(new AppError(403, "AUTH_CSRF_INVALID", "Token CSRF invalid pentru refresh."));
    return;
  }

  try {
    res.setHeader("Cache-Control", "private, no-store");
    const rotated = await rotateRefreshTokenSession(refreshToken, csrfHeader, {
      userAgent: readUserAgent(req),
      ipAddress: readClientIp(req),
    });

    if (!rotated) {
      clearRefreshCookies(res);
      next(new AppError(401, "AUTH_UNAUTHORIZED", "Refresh token invalid sau expirat."));
      return;
    }

    let adminSessionId: string | undefined;
    // Redis stores a user snapshot. Re-read identity and role before minting a
    // new token, including after a promotion, demotion or deleted account.
    const currentUser = await prisma.user.findUnique({ where: { id: BigInt(rotated.user.id) }, select: { id: true, email: true, fullName: true, role: true } });
    if (!currentUser) {
      await revokeRefreshToken(rotated.session.token);
      clearRefreshCookies(res);
      next(new AppError(401, "AUTH_UNAUTHORIZED", "Contul nu mai este disponibil."));
      return;
    }
    rotated.user = { id: currentUser.id.toString(), fullName: currentUser.fullName, email: currentUser.email, role: currentUser.role as UserRole };
    if (isAdminRole(rotated.user.role) && !isPublicAdminUser(rotated.user)) {
      adminSessionId = await rotateAdminSession(rotated.user.id, refreshToken, rotated.session.token) ?? undefined;
      if (!adminSessionId) {
        await revokeRefreshToken(rotated.session.token);
        clearRefreshCookies(res);
        next(new AppError(401, "AUTH_MFA_SESSION_REQUIRED", "Autentifică-te din nou cu parola și codul din aplicația de autentificare."));
        return;
      }
    }
    const expiresInSeconds = isAdminRole(rotated.user.role) ? Math.min(env.authTokenTtlSeconds, adminAccessTokenLifetimeSeconds) : env.authTokenTtlSeconds;
    const token = await createAuthToken({
      id: rotated.user.id,
      fullName: rotated.user.fullName,
      email: rotated.user.email,
      role: rotated.user.role,
      adminSessionId,
      expiresInSeconds,
    });

    setRefreshCookies(res, rotated.session);
    sendSuccess(res, {
      message: "Token reimprospatat cu succes.",
      token,
      tokenType: "Bearer",
      expiresInSeconds,
      accessTokenExpiresAt: readExpiryIso(expiresInSeconds),
      csrfToken: rotated.session.csrfToken,
      refreshExpiresInSeconds: rotated.session.expiresInSeconds,
      refreshTokenExpiresAt: readExpiryIso(rotated.session.expiresInSeconds),
      tokenPolicy: buildAuthTokenPolicy(),
      user: sanitizeUser(rotated.user),
    });
  } catch (error) {
    next(error);
  }
}
