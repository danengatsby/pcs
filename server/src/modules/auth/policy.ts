import { env } from "../../lib/env.js";
import { refreshCookiePath, refreshCsrfHeaderName, type AuthTokenPolicy } from "./types.js";

export function buildAuthTokenPolicy(): AuthTokenPolicy {
  if (!env.authRefreshEnabled) {
    return {
      accessTokenTtlSeconds: env.authTokenTtlSeconds,
      refreshToken: {
        enabled: false,
        ttlSeconds: null,
        rotation: "disabled",
        transport: "disabled",
        csrfProtection: "disabled",
        csrfHeader: null,
        cookiePath: null,
      },
    };
  }

  return {
    accessTokenTtlSeconds: env.authTokenTtlSeconds,
    refreshToken: {
      enabled: true,
      ttlSeconds: env.authRefreshTtlSeconds,
      rotation: "rotate-on-refresh",
      transport: "httpOnly-cookie",
      csrfProtection: "double-submit-cookie",
      csrfHeader: refreshCsrfHeaderName,
      cookiePath: refreshCookiePath,
    },
  };
}

export function readExpiryIso(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}
