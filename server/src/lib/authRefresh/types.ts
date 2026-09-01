import type { UserRole } from "../authToken.js";

export type RefreshSessionUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

export type RefreshSessionUserSnapshot = Omit<RefreshSessionUser, "id">;

export type RefreshTokenLookupRow = {
  id: string;
  userId: string;
  expiresAt: string;
  revokedAt: string | null;
  csrfTokenHash: string | null;
  fullName: string;
  email: string;
  role: UserRole;
};

export type RefreshTokenSession = {
  token: string;
  csrfToken: string;
  expiresInSeconds: number;
};

export type RotatedRefreshSession = {
  user: RefreshSessionUser;
  session: RefreshTokenSession;
};
