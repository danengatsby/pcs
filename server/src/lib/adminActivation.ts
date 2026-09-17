import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { Secret, TOTP } from "otpauth";
import { withTransaction } from "./db.js";
import { env } from "./env.js";
import { AppError } from "./errors.js";
import { hashPassword } from "./password.js";
import { auditAdminSecurity, isAdminRole } from "./adminMfa.js";
import { createMfaEnrollment, decryptMfaSecret, encryptMfaSecret, validateMfaCode } from "./adminMfaCrypto.js";
import type { UserPublicRow } from "../modules/auth/types.js";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const invalidInvitation = () => new AppError(403, "AUTH_ACTIVATION_INVALID", "Linkul de activare este invalid, a expirat sau a fost deja folosit. Solicită un link nou administratorului.");
type Credential = { id: string; encrypted_secret: string; enabled_at: Date | null; failed_attempts: number; locked_until: Date | null; last_step: string; expires_at: Date };

// Operator-issued bootstrap capability. A password or an email alone cannot
// obtain it; it cannot reset an already activated administrator.
export async function issueAdminActivation(input: {
  email: string; operator: string; reason: string;
  deliver: (invitation: { email: string; url: string; expiresAt: string }) => Promise<void>;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || input.operator.trim().length < 3 || input.operator.length > 180 || input.reason.trim().length < 10 || input.reason.length > 2000) {throw new Error("Titularul, operatorul și motivul documentat sunt obligatorii.");}
  const origin = new URL(env.publicBaseUrl || "http://localhost:5173");
  if (env.nodeEnv === "production" && (origin.protocol !== "https:" || !env.publicBaseUrl)) {throw new Error("Activarea necesită PUBLIC_BASE_URL HTTPS în producție.");}
  await withTransaction(async (client) => {
    const user = (await client.query<UserPublicRow>('SELECT id::text,email,full_name AS "fullName",role FROM users WHERE LOWER(email)=$1 FOR UPDATE', [email])).rows[0];
    if (!user || !isAdminRole(user.role)) {throw new Error("Este necesar un cont nominal cu rol administrativ.");}
    const existing = (await client.query("SELECT enabled_at FROM admin_mfa_credentials WHERE user_id=$1 FOR UPDATE", [user.id])).rows[0];
    if (existing?.enabled_at) {throw new Error("Contul are deja MFA activ. Invitația inițială nu poate reseta accesul.");}
    const enrollment = createMfaEnrollment(user.email);
    const credentialId = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    // A renewed invitation invalidates every earlier bootstrap file and link.
    await client.query("DELETE FROM admin_mfa_credentials WHERE user_id=$1", [user.id]);
    await client.query("INSERT INTO admin_mfa_credentials (user_id,id,encrypted_secret) VALUES ($1,$2,$3)", [user.id, credentialId, encryptMfaSecret(enrollment.secret, env.authMfaEncryptionKey, user.id)]);
    await client.query("INSERT INTO admin_activation_invitations (id,user_id,credential_id,token_hash,expires_at) VALUES ($1,$2,$3,$4,$5)", [randomUUID(), user.id, credentialId, tokenHash(token), expiresAt]);
    await auditAdminSecurity(client, { userId: user.id, email: user.email, role: user.role, operator: input.operator, action: "auth.admin_invite_activation", details: { reason: input.reason, expiresAt: expiresAt.toISOString() } });
    const url = new URL("/auth/activate", origin);
    url.hash = token;
    await input.deliver({ email, url: url.toString(), expiresAt: expiresAt.toISOString() });
  });
}

async function readInvitation(client: PoolClient, token: string): Promise<{ user: UserPublicRow; credential: Credential }> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {throw invalidInvitation();}
  const invitation = (await client.query<{ user_id: string }>("SELECT user_id::text FROM admin_activation_invitations WHERE token_hash=$1", [tokenHash(token)])).rows[0];
  if (!invitation) {throw invalidInvitation();}
  const user = (await client.query<UserPublicRow>('SELECT id::text,email,full_name AS "fullName",role FROM users WHERE id=$1 FOR NO KEY UPDATE', [invitation.user_id])).rows[0];
  const credential = (await client.query<Credential>(`SELECT c.*,i.expires_at FROM admin_activation_invitations i
    JOIN admin_mfa_credentials c ON c.id=i.credential_id AND c.user_id=i.user_id
    WHERE i.token_hash=$1 AND i.user_id=$2 FOR UPDATE OF c,i`, [tokenHash(token), invitation.user_id])).rows[0];
  if (!user || !isAdminRole(user.role) || !credential || credential.enabled_at || credential.expires_at.getTime() <= Date.now()) {throw invalidInvitation();}
  return { user, credential };
}

export async function previewAdminActivation(token: string): Promise<{ fullName: string; email: string; secret: string; uri: string; expiresAt: string }> {
  return withTransaction(async (client) => {
    const { user, credential } = await readInvitation(client, token);
    const secret = decryptMfaSecret(credential.encrypted_secret, env.authMfaEncryptionKey, user.id);
    const totp = new TOTP({ issuer: "PCS", label: user.email, secret: Secret.fromBase32(secret), algorithm: "SHA1", digits: 6, period: 30 });
    return { fullName: user.fullName, email: user.email, secret, uri: totp.toString(), expiresAt: credential.expires_at.toISOString() };
  });
}

export async function completeAdminActivation(input: { token: string; password: string; mfaCode: string }): Promise<{ user: UserPublicRow; credentialId: string }> {
  const result = await withTransaction(async (client) => {
    const { user, credential } = await readInvitation(client, input.token);
    if (credential.locked_until && credential.locked_until.getTime() > Date.now()) {return { error: new AppError(429, "AUTH_MFA_LOCKED", "Prea multe coduri incorecte. Încearcă din nou peste 15 minute.") };}
    const step = validateMfaCode(decryptMfaSecret(credential.encrypted_secret, env.authMfaEncryptionKey, user.id), input.mfaCode);
    if (step === null || step <= Number(credential.last_step)) {
      const attempts = (credential.locked_until ? 0 : credential.failed_attempts) + 1;
      await client.query("UPDATE admin_mfa_credentials SET failed_attempts=$2,locked_until=CASE WHEN $2>=5 THEN NOW()+INTERVAL '15 minutes' ELSE NULL END WHERE user_id=$1", [user.id, attempts]);
      await auditAdminSecurity(client, { userId: user.id, email: user.email, role: user.role, action: "auth.mfa_failed", details: { phase: "activation" } });
      return { error: new AppError(attempts >= 5 ? 429 : 403, attempts >= 5 ? "AUTH_MFA_LOCKED" : "AUTH_MFA_INVALID", attempts >= 5 ? "Prea multe coduri incorecte. Încearcă din nou peste 15 minute." : "Cod incorect. Introdu codul curent din aplicația de autentificare.") };
    }
    await client.query("UPDATE users SET password_hash=$2 WHERE id=$1", [user.id, await hashPassword(input.password)]);
    await client.query("UPDATE admin_mfa_credentials SET enabled_at=NOW(),last_step=$2,failed_attempts=0,locked_until=NULL WHERE user_id=$1", [user.id, step]);
    await client.query("DELETE FROM admin_activation_invitations WHERE user_id=$1", [user.id]);
    await client.query("DELETE FROM admin_auth_sessions WHERE user_id=$1", [user.id]);
    await client.query("UPDATE auth_refresh_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=$1", [user.id]);
    await auditAdminSecurity(client, { userId: user.id, email: user.email, role: user.role, action: "auth.admin_activate", details: { secondFactor: "totp", passwordChosenByHolder: true } });
    return { user, credentialId: credential.id };
  });
  if (result.error) {throw result.error;}
  return { user: result.user!, credentialId: result.credentialId! };
}
