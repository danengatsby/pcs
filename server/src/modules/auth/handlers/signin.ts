import type { NextFunction, Request, Response } from "express";
import { createAuthToken } from "../../../lib/authToken.js";
import { createRefreshTokenSession } from "../../../lib/authRefreshToken.js";
import { AppError } from "../../../lib/errors.js";
import { env } from "../../../lib/env.js";
import { sendSuccess } from "../../../lib/http.js";
import { verifyPassword } from "../../../lib/password.js";
import { setRefreshCookies } from "../cookies.js";
import { buildAuthTokenPolicy, readExpiryIso } from "../policy.js";
import { readClientIp, readUserAgent } from "../requestContext.js";
import { findUserForSignin } from "../repository.js";
import { consumeDummySigninHash, sanitizeUser } from "../user.js";
import { signinSchema } from "../validation.js";

export async function signinHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = signinSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(
      new AppError(
        400,
        "AUTH_SIGNIN_VALIDATION_FAILED",
        issue?.message ?? "Date signin invalide."
      )
    );
    return;
  }

  const payload = parsed.data;

  try {
    const user = await findUserForSignin(payload.email);
    if (!user) {
      await consumeDummySigninHash(payload.password);
      next(new AppError(401, "INVALID_CREDENTIALS", "Email sau parola invalida."));
      return;
    }

    const isPasswordValid = await verifyPassword(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      next(new AppError(401, "INVALID_CREDENTIALS", "Email sau parola invalida."));
      return;
    }

    const token = await createAuthToken({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    });

    const refreshSession = await createRefreshTokenSession({
      userId: user.id,
      user: {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      userAgent: readUserAgent(req),
      ipAddress: readClientIp(req),
    });

    if (refreshSession) {
      setRefreshCookies(res, refreshSession);
    }

    sendSuccess(res, {
      message: "Autentificare reusita.",
      token,
      tokenType: "Bearer",
      expiresInSeconds: env.authTokenTtlSeconds,
      accessTokenExpiresAt: readExpiryIso(env.authTokenTtlSeconds),
      csrfToken: refreshSession?.csrfToken,
      refreshExpiresInSeconds: refreshSession?.expiresInSeconds,
      refreshTokenExpiresAt: refreshSession?.expiresInSeconds
        ? readExpiryIso(refreshSession.expiresInSeconds)
        : undefined,
      tokenPolicy: buildAuthTokenPolicy(),
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
}
