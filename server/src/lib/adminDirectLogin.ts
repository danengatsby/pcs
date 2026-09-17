import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { query, withTransaction } from "./db.js";
import { env } from "./env.js";
import { AppError } from "./errors.js";
import { auditAdminSecurity, isAdminRole } from "./adminMfa.js";
import type { UserPublicRow } from "../modules/auth/types.js";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const invalidLink = () => new AppError(403, "AUTH_DIRECT_LOGIN_INVALID", "Linkul de acces direct a expirat, a fost folosit sau nu mai este valabil. Solicită un link personal nou.");
type Account = UserPublicRow & { password_hash: string; credential_id: string; profile: string | null; profile_updated_at: string | null };
const accountSql = `SELECT u.id::text,u.email,u.full_name AS "fullName",u.role,u.password_hash,
  c.id AS credential_id,p.profile,p.updated_at::text AS profile_updated_at
  FROM users u JOIN admin_mfa_credentials c ON c.user_id=u.id AND c.enabled_at IS NOT NULL
  LEFT JOIN admin_access_profiles p ON p.user_id=u.id`;
const authState = (user: Account) => digest(JSON.stringify([user.id, user.email, user.role, user.password_hash, user.credential_id, user.profile, user.profile_updated_at]));

export async function issueAdminDirectLogin(input: {
  email: string; operator: string; reason: string;
  deliver: (link: { email: string; url: string; expiresAt: string }) => Promise<void>;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180
    || input.operator.trim().length < 3 || input.operator.length > 180
    || input.reason.trim().length < 10 || input.reason.length > 2000) {
    throw new Error("Titularul, operatorul și motivul documentat sunt obligatorii.");
  }
  const origin = new URL(env.publicBaseUrl || "http://localhost:5173");
  if (env.nodeEnv === "production" && (origin.protocol !== "https:" || !env.publicBaseUrl)) {
    throw new Error("Accesul direct necesită PUBLIC_BASE_URL HTTPS în producție.");
  }
  await withTransaction(async client => {
    const user = (await client.query<Account>(accountSql + " WHERE LOWER(u.email)=$1 FOR UPDATE OF u FOR KEY SHARE OF c", [email])).rows[0];
    if (!user || !isAdminRole(user.role)) {throw new Error("Este necesar un cont nominal administrativ deja activat.");}
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await client.query("DELETE FROM admin_direct_login_links WHERE user_id=$1", [user.id]);
    await client.query("INSERT INTO admin_direct_login_links (id,user_id,credential_id,token_hash,auth_state_hash,issued_by,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [randomUUID(), user.id, user.credential_id, digest(token), authState(user), input.operator.trim(), expiresAt]);
    await auditAdminSecurity(client, { userId: user.id, email: user.email, role: user.role, operator: input.operator,
      action: "auth.admin_direct_link_issued", details: { reason: input.reason, expiresAt: expiresAt.toISOString(), authenticationMethod: "operator_link" } });
    const url = new URL("/auth/signin", origin);
    url.hash = token;
    await input.deliver({ email, url: url.toString(), expiresAt: expiresAt.toISOString() });
  });
}

// This first read identifies the account. Consumption is repeated under locks
// inside the same transaction that creates the administrative session.
export async function readAdminDirectLogin(token: string): Promise<{ user: UserPublicRow; credentialId: string }> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {throw invalidLink();}
  const row = (await query<Account & { auth_state_hash: string }>(accountSql.replace("SELECT u.id", "SELECT l.auth_state_hash,u.id") + ` JOIN admin_direct_login_links l ON l.user_id=u.id AND l.credential_id=c.id
    WHERE l.token_hash=$1 AND l.expires_at>NOW()`, [digest(token)])).rows[0];
  if (!row || !isAdminRole(row.role) || authState(row) !== row.auth_state_hash) {throw invalidLink();}
  return { user: { id: row.id, fullName: row.fullName, email: row.email, role: row.role }, credentialId: row.credential_id };
}

export async function consumeAdminDirectLogin(client: PoolClient, token: string, userId: string, credentialId: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {throw invalidLink();}
  const user = (await client.query<Account>(accountSql + " WHERE u.id=$1 FOR NO KEY UPDATE OF u FOR KEY SHARE OF c", [userId])).rows[0];
  const link = (await client.query<{ auth_state_hash: string; issued_by: string }>(`SELECT auth_state_hash,issued_by FROM admin_direct_login_links
    WHERE user_id=$1 AND credential_id=$2 AND token_hash=$3 AND expires_at>NOW() FOR UPDATE`, [userId, credentialId, digest(token)])).rows[0];
  if (!user || !isAdminRole(user.role) || !link || user.credential_id !== credentialId || authState(user) !== link.auth_state_hash) {throw invalidLink();}
  await client.query("DELETE FROM admin_direct_login_links WHERE user_id=$1", [userId]);
  await auditAdminSecurity(client, { userId, email: user.email, role: user.role, action: "auth.admin_direct_link_used", details: { issuedBy: link.issued_by, authenticationMethod: "operator_link" } });
}
