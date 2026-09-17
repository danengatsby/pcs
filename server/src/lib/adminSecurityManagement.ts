import { randomUUID } from "node:crypto";
import { withTransaction } from "./db.js";
import { env } from "./env.js";
import { adminProfileNames, type AdminProfile } from "./adminAccessProfiles.js";
import { auditAdminSecurity, isAdminRole } from "./adminMfa.js";
import { createMfaEnrollment, encryptMfaSecret } from "./adminMfaCrypto.js";

type SecurityChange = {
  email: string; operator: string; reason: string;
} & (
  | { action: "enroll-mfa"; deliverEnrollment: (enrollment: { email: string; secret: string; uri: string }) => Promise<void> }
  | { action: "reset-mfa" }
  | { action: "set-profile"; profile: AdminProfile }
);

// Server-operator entry point. It is deliberately not an unauthenticated web
// enrollment/reset endpoint: possession of a password cannot replace MFA.
export async function manageAdminSecurity(input: SecurityChange): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const operator = input.operator.trim().toLowerCase();
  const reason = input.reason.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email) || !emailPattern.test(operator) || email.length > 180 || operator.length > 180 || reason.length < 10 || reason.length > 2000) {
    throw new Error("Emailurile complete ale titularului și operatorului și un motiv de 10–2000 caractere sunt obligatorii.");
  }
  if (input.action === "set-profile" && !adminProfileNames.includes(input.profile)) {
    throw new Error("Profil administrativ necunoscut.");
  }
  await withTransaction(async (client) => {
    const rows = await client.query<{ id: string; email: string; role: string }>(
      "SELECT id::text, email, role FROM users WHERE LOWER(email) = $1 FOR UPDATE", [email]);
    const user = rows.rows[0];
    if (!user || !isAdminRole(user.role)) {
      throw new Error("Este necesar un cont personal existent cu rol administrativ.");
    }
    let previousProfile: string | null = null;
    if (input.action === "enroll-mfa") {
      const existing = await client.query("SELECT 1 FROM admin_mfa_credentials WHERE user_id = $1", [user.id]);
      if (existing.rowCount) { throw new Error("Contul are deja o cheie MFA. Recuperarea necesită reset-mfa și un motiv auditat."); }
      const enrollment = createMfaEnrollment(user.email);
      await client.query("INSERT INTO admin_mfa_credentials (user_id, id, encrypted_secret) VALUES ($1, $2, $3)", [
        user.id, randomUUID(), encryptMfaSecret(enrollment.secret, env.authMfaEncryptionKey, user.id),
      ]);
      await input.deliverEnrollment({ email: user.email, ...enrollment });
    } else if (input.action === "reset-mfa") {
      await client.query("DELETE FROM admin_mfa_credentials WHERE user_id = $1", [user.id]);
    } else {
      await client.query("DELETE FROM admin_direct_login_links WHERE user_id=$1", [user.id]);
      await client.query("DELETE FROM admin_activation_invitations WHERE user_id=$1", [user.id]);
      const previous = await client.query<{ profile: string }>("SELECT profile FROM admin_access_profiles WHERE user_id = $1", [user.id]);
      previousProfile = previous.rows[0]?.profile ?? null;
      await client.query(`INSERT INTO admin_access_profiles (user_id, profile, assigned_by, reason)
        VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET profile = EXCLUDED.profile,
        assigned_by = EXCLUDED.assigned_by, reason = EXCLUDED.reason, updated_at = NOW()`, [user.id, input.profile, operator, reason]);
    }
    // Deleting the MFA attestation invalidates access tokens AND refresh tokens,
    // independently of which ordinary refresh store (SQL/Redis) is configured.
    await client.query("DELETE FROM admin_auth_sessions WHERE user_id = $1", [user.id]);
    await auditAdminSecurity(client, {
      userId: user.id, email: user.email, role: user.role, operator,
      action: `auth.admin_${input.action.replaceAll("-", "_")}`,
      details: { reason, ...(input.action === "set-profile" ? { previousProfile, profile: input.profile } : {}) },
    });
  });
}
