import { verifyPassword } from "../../lib/password.js";
import { dummySigninPasswordHash, type UserPublicRow } from "./types.js";

export function sanitizeUser(user: UserPublicRow): UserPublicRow {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  };
}

export async function consumeDummySigninHash(password: string): Promise<void> {
  await verifyPassword(password, dummySigninPasswordHash);
}
