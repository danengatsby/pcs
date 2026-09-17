import type { Request, Response } from "express";
import { createAuthToken } from "../../../lib/authToken.js";
import { createRefreshTokenSession, revokeRefreshToken } from "../../../lib/authRefreshToken.js";
import { adminAccessTokenLifetimeSeconds, createAdminSession, isAdminRole, type OperatorLinkAuthorization } from "../../../lib/adminMfa.js";
import { env } from "../../../lib/env.js";
import { sendSuccess } from "../../../lib/http.js";
import { setRefreshCookies } from "../cookies.js";
import { buildAuthTokenPolicy, readExpiryIso } from "../policy.js";
import { readClientIp, readUserAgent } from "../requestContext.js";
import { sanitizeUser } from "../user.js";
import type { UserPublicRow } from "../types.js";

export async function sendAuthenticatedSession(req: Request, res: Response, user: UserPublicRow, credentialId: string | null, operatorLink?: OperatorLinkAuthorization): Promise<void> {
  user = sanitizeUser(user);
  const refreshSession = await createRefreshTokenSession({ userId: user.id, user, userAgent: readUserAgent(req), ipAddress: readClientIp(req) });
  let adminSessionId: string | undefined;
  try {
    adminSessionId = credentialId ? await createAdminSession(user, credentialId, refreshSession?.token, operatorLink) : undefined;
  } catch (error) {
    if (refreshSession) {await revokeRefreshToken(refreshSession.token);}
    throw error;
  }
  const expiresInSeconds = isAdminRole(user.role) ? Math.min(env.authTokenTtlSeconds, adminAccessTokenLifetimeSeconds) : env.authTokenTtlSeconds;
  const token = await createAuthToken({ ...user, adminSessionId, expiresInSeconds });
  if (refreshSession) {setRefreshCookies(res, refreshSession);}
  sendSuccess(res, {
    message: "Autentificare reusita.", token, tokenType: "Bearer", expiresInSeconds,
    accessTokenExpiresAt: readExpiryIso(expiresInSeconds), csrfToken: refreshSession?.csrfToken,
    refreshExpiresInSeconds: refreshSession?.expiresInSeconds,
    refreshTokenExpiresAt: refreshSession?.expiresInSeconds ? readExpiryIso(refreshSession.expiresInSeconds) : undefined,
    tokenPolicy: buildAuthTokenPolicy(), user: sanitizeUser(user),
  });
}
