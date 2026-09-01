import type { NextFunction, Request, Response } from "express";
import { readBearerToken, verifyAuthToken } from "../../../lib/authToken.js";
import { revokeToken } from "../../../lib/authTokenRevocation.js";
import { revokeRefreshToken } from "../../../lib/authRefreshToken.js";
import { AppError } from "../../../lib/errors.js";
import { sendSuccess } from "../../../lib/http.js";
import {
  clearRefreshCookies,
  readRefreshCookie,
  readRefreshCsrfCookie,
  readRefreshCsrfHeader,
} from "../cookies.js";

export async function handleSignout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = readRefreshCookie(req);
    const csrfCookie = readRefreshCsrfCookie(req);
    const csrfHeader = readRefreshCsrfHeader(req);
    const hasRefreshSignoutContext = Boolean(refreshToken || csrfCookie);

    if (hasRefreshSignoutContext) {
      if (!refreshToken) {
        next(new AppError(400, "AUTH_SIGNOUT_REFRESH_MISSING", "Refresh token lipsa pentru logout."));
        return;
      }

      if (!csrfCookie || !csrfHeader) {
        next(new AppError(400, "AUTH_CSRF_MISSING", "Token CSRF lipsa pentru logout."));
        return;
      }

      if (csrfCookie !== csrfHeader) {
        next(new AppError(403, "AUTH_CSRF_INVALID", "Token CSRF invalid pentru logout."));
        return;
      }

      await revokeRefreshToken(refreshToken);
    }

    const bearerToken = readBearerToken(req.header("authorization"));
    if (bearerToken) {
      const tokenPayload = await verifyAuthToken(bearerToken);
      if (tokenPayload) {
        await revokeToken({ jti: tokenPayload.jti, exp: tokenPayload.exp });
      }
    }

    clearRefreshCookies(res);
    sendSuccess(res, { message: "Deconectare reusita." });
  } catch (error) {
    next(error);
  }
}
