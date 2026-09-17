import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { UserRole } from "./authToken.js";
import { query, withTransaction } from "./db.js";
import { env } from "./env.js";
import { AppError } from "./errors.js";
import { decryptMfaSecret, validateMfaCode } from "./adminMfaCrypto.js";

export const adminSessionLifetimeSeconds = 8 * 60 * 60;
export const adminAccessTokenLifetimeSeconds = 15 * 60;
const hashRefresh = (token: string) => createHash("sha256").update(token).digest("hex");

export function isAdminRole(role: UserRole | string): boolean {
  return ["PRESEDINTE", "VICEPRESEDINTE", "SECRETAR", "CONSILIER"].includes(role);
}

export async function auditAdminSecurity(client: PoolClient, input: {
  userId: string; email: string; role: string; action: string; operator?: string; details?: Record<string, unknown>;
}): Promise<void> {
  await client.query(`INSERT INTO admin_audit_log (actor_user_id, actor_email, actor_role, action, target_type, target_id, details)
    VALUES ($1, $2, $3, $4, 'user', $5, $6::jsonb)`, [
    input.operator ? null : input.userId, input.operator ?? input.email,
    input.operator ? "SYSTEM" : input.role, input.action, input.userId, JSON.stringify(input.details ?? {}),
  ]);
}

export async function verifyAdminSecondFactor(user: { id: string; email: string; role: UserRole }, code?: string): Promise<string> {
  // Lock the account credential, not the submitted username: aliases and concurrent
  // attempts share one retry budget and a TOTP can be consumed only once.
  const result = await withTransaction(async (client) => {
    const rows = await client.query<{
      id: string; encrypted_secret: string; last_step: string; failed_attempts: number; locked_until: Date | null;
    }>("SELECT * FROM admin_mfa_credentials WHERE user_id = $1 FOR UPDATE", [user.id]);
    const credential = rows.rows[0];
    if (!credential) { return { error: "AUTH_MFA_SETUP_REQUIRED" } as const; }
    if (!code) { return { error: "AUTH_MFA_REQUIRED" } as const; }
    const now = Date.now();
    if (credential.locked_until && credential.locked_until.getTime() > now) {
      return { error: "AUTH_MFA_LOCKED" } as const;
    }
    const secret = decryptMfaSecret(credential.encrypted_secret, env.authMfaEncryptionKey, user.id);
    const step = validateMfaCode(secret, code, now);
    if (step === null || step <= Number(credential.last_step)) {
      const attempts = (credential.locked_until ? 0 : credential.failed_attempts) + 1;
      await client.query(`UPDATE admin_mfa_credentials SET failed_attempts = $2,
        locked_until = CASE WHEN $2 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END WHERE user_id = $1`, [user.id, attempts]);
      await auditAdminSecurity(client, { userId: user.id, email: user.email, role: user.role, action: "auth.mfa_failed" });
      return { error: attempts >= 5 ? "AUTH_MFA_LOCKED" : "AUTH_MFA_INVALID" } as const;
    }
    await client.query(`UPDATE admin_mfa_credentials SET last_step = $2, failed_attempts = 0,
      locked_until = NULL, enabled_at = COALESCE(enabled_at, NOW()) WHERE user_id = $1`, [user.id, step]);
    return { credentialId: credential.id };
  });
  if (result.credentialId) { return result.credentialId; }
  const messages = {
    AUTH_MFA_SETUP_REQUIRED: "Contul administrativ necesită activarea autentificării în doi pași. Contactează administratorul pentru înrolarea aplicației de autentificare.",
    AUTH_MFA_REQUIRED: "Introdu codul de 6 cifre din aplicația de autentificare.",
    AUTH_MFA_INVALID: "Cod invalid sau deja folosit. Introdu un cod nou din aplicația de autentificare.",
    AUTH_MFA_LOCKED: "Prea multe coduri incorecte. Încearcă din nou peste 15 minute.",
  };
  throw new AppError(result.error === "AUTH_MFA_LOCKED" ? 429 : 403, result.error!, messages[result.error!]);
}

export type OperatorLinkAuthorization = { verify: (client: PoolClient) => Promise<void> };

export async function createAdminSession(user: { id: string; email: string; role: UserRole }, credentialId: string, refreshToken?: string, operatorLink?: OperatorLinkAuthorization): Promise<string> {
  const id = randomUUID();
  await withTransaction(async (client) => {
    await operatorLink?.verify(client);
    // FK to the credential makes a concurrent MFA reset fail closed.
    await client.query(`INSERT INTO admin_auth_sessions (id, user_id, credential_id, refresh_token_hash, expires_at)
      VALUES ($1, $2, $3, $4, NOW() + INTERVAL '8 hours')`, [id, user.id, credentialId, refreshToken ? hashRefresh(refreshToken) : null]);
    await auditAdminSecurity(client, { userId: user.id, email: user.email, role: user.role, action: "auth.admin_signin", details: {
      sessionId: id, ...(operatorLink ? { authenticationMethod: "operator_link" } : { secondFactor: "totp" }),
    } });
  });
  return id;
}

export async function isAdminSessionValid(userId: string, sessionId?: string): Promise<boolean> {
  if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) { return false; }
  const rows = await query(`SELECT 1 FROM admin_auth_sessions session
    JOIN admin_mfa_credentials credential ON credential.id = session.credential_id AND credential.user_id = session.user_id
    WHERE session.id = $1 AND session.user_id = $2 AND session.expires_at > NOW() AND credential.enabled_at IS NOT NULL`, [sessionId, userId]);
  return rows.rowCount === 1;
}

export async function rotateAdminSession(userId: string, oldRefresh: string, newRefresh: string): Promise<string | null> {
  const rows = await query<{ id: string }>(`UPDATE admin_auth_sessions session SET refresh_token_hash = $3
    FROM admin_mfa_credentials credential WHERE session.user_id = $1 AND session.refresh_token_hash = $2
      AND session.expires_at > NOW() AND credential.id = session.credential_id
      AND credential.user_id = session.user_id AND credential.enabled_at IS NOT NULL
    RETURNING session.id`, [userId, hashRefresh(oldRefresh), hashRefresh(newRefresh)]);
  return rows.rows[0]?.id ?? null;
}

export async function revokeAdminSession(input: { sessionId?: string; refreshToken?: string; userId?: string }): Promise<void> {
  if (input.userId) {
    await withTransaction(async client => {
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [input.userId]);
      await client.query("DELETE FROM admin_direct_login_links WHERE user_id=$1", [input.userId]);
      await client.query("DELETE FROM admin_auth_sessions WHERE user_id=$1", [input.userId]);
    });
  } else if (input.sessionId) {
    await query("DELETE FROM admin_auth_sessions WHERE id = $1", [input.sessionId]);
  } else if (input.refreshToken) {
    await query("DELETE FROM admin_auth_sessions WHERE refresh_token_hash = $1", [hashRefresh(input.refreshToken)]);
  }
}
