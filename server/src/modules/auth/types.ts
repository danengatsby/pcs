import type { UserRole } from "../../lib/authToken.js";

export type UserPublicRow = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

export type UserAuthRow = UserPublicRow & {
  passwordHash: string;
};

export type AuthTokenPolicy = {
  accessTokenTtlSeconds: number;
  refreshToken: {
    enabled: boolean;
    ttlSeconds: number | null;
    rotation: "rotate-on-refresh" | "disabled";
    transport: "httpOnly-cookie" | "disabled";
    csrfProtection: "double-submit-cookie" | "disabled";
    csrfHeader: string | null;
    cookiePath: string | null;
  };
};

export type SignupUniformResponse = {
  message: string;
  signupAccepted: true;
  nextStep: "signin";
};

export type ParsedCookies = Record<string, string>;

export const refreshTokenCookieName = "pcp_refresh_token";
export const refreshCsrfCookieName = "pcp_refresh_csrf";
export const refreshCookiePath = "/api/auth";
export const refreshCsrfHeaderName = "x-csrf-token";
export const signupUniformMessage = "Cererea de creare cont a fost procesata. Daca ai deja cont, foloseste autentificarea.";
export const dummySigninPasswordHash = `scrypt$pcp-dummy-salt$${"ab".repeat(64)}`;
