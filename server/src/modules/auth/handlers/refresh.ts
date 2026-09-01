import type { NextFunction, Request, Response } from "express";
import { createAuthToken } from "../../../lib/authToken.js";
import { rotateRefreshTokenSession } from "../../../lib/authRefreshToken.js";
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
    const rotated = await rotateRefreshTokenSession(refreshToken, csrfHeader, {
      userAgent: readUserAgent(req),
      ipAddress: readClientIp(req),
    });

    if (!rotated) {
      clearRefreshCookies(res);
      next(new AppError(401, "AUTH_UNAUTHORIZED", "Refresh token invalid sau expirat."));
      return;
    }

    const token = await createAuthToken({
      id: rotated.user.id,
      fullName: rotated.user.fullName,
      email: rotated.user.email,
      role: rotated.user.role,
    });

    setRefreshCookies(res, rotated.session);
    sendSuccess(res, {
      message: "Token reimprospatat cu succes.",
      token,
      tokenType: "Bearer",
      expiresInSeconds: env.authTokenTtlSeconds,
      accessTokenExpiresAt: readExpiryIso(env.authTokenTtlSeconds),
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
