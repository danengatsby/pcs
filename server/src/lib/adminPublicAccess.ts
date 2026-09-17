import { randomBytes } from "node:crypto";
import { env } from "./env.js";
import { query, withTransaction } from "./db.js";
import { hashPassword } from "./password.js";
import { AppError } from "./errors.js";
import { auditAdminSecurity } from "./adminMfa.js";
import type { UserPublicRow } from "../modules/auth/types.js";

export const publicAdminEmail = "administrator-public@pcs.invalid";

// Public access uses its own shared actor, never an individual's account.
export function isPublicAdminUser(user: Pick<UserPublicRow, "email" | "role">): boolean {
  return env.authPublicAdminEnabled && user.email === publicAdminEmail && user.role === "PRESEDINTE";
}

export async function openPublicAdminAccess(): Promise<UserPublicRow> {
  if (!env.authPublicAdminEnabled) {
    throw new AppError(403, "AUTH_PUBLIC_ADMIN_DISABLED", "Accesul administrativ public este dezactivat.");
  }
  const existing = await query("SELECT id FROM users WHERE email=$1", [publicAdminEmail]);
  if (!existing.rowCount) {
    // The account has no distributed password and does not send email.
    await query(`INSERT INTO users(full_name,email,password_hash,role)
      VALUES ('Administrator public PCS',$1,$2,'PRESEDINTE') ON CONFLICT (LOWER(email)) DO NOTHING`,
    [publicAdminEmail, await hashPassword(randomBytes(48).toString("base64url"))]);
  }
  return withTransaction(async client => {
    const user = (await client.query<UserPublicRow>(`SELECT id::text,email,full_name AS "fullName",role
      FROM users WHERE email=$1 FOR SHARE`, [publicAdminEmail])).rows[0];
    if (!user || !isPublicAdminUser(user)) {
      throw new AppError(403, "AUTH_PUBLIC_ADMIN_UNAVAILABLE", "Contul de administrare publică nu este disponibil.");
    }
    await auditAdminSecurity(client, {
      userId: user.id, email: user.email, role: user.role, action: "auth.admin_public_signin",
      details: { authenticationMethod: "public", sharedAccount: true },
    });
    return user;
  });
}
