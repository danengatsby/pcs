import "./dbTestUtils.js";
import { setTimeout as delay } from "node:timers/promises";
import { Secret, TOTP } from "otpauth";
import { query } from "../../lib/db.js";
import { env } from "../../lib/env.js";
import { decryptMfaSecret } from "../../lib/adminMfaCrypto.js";
import { createAdminSession, isAdminRole, verifyAdminSecondFactor } from "../../lib/adminMfa.js";
import { manageAdminSecurity } from "../../lib/adminSecurityManagement.js";
import { findUserForSignin } from "../../modules/auth/repository.js";
import { createAuthToken, type UserRole } from "../../lib/authToken.js";

export async function signinTestInput(input: { email: string; password: string }): Promise<{ email: string; password: string; mfaCode?: string }> {
  const user = await findUserForSignin(input.email);
  if (!user || !isAdminRole(user.role)) { return input; }
  let credential = (await query<{ encrypted_secret: string; last_step: string }>("SELECT encrypted_secret, last_step FROM admin_mfa_credentials WHERE user_id = $1", [user.id])).rows[0];
  if (!credential) {
    await manageAdminSecurity({ email: user.email, operator: "test-operator@example.test", reason: "Înrolare pentru testul automat izolat", action: "enroll-mfa", deliverEnrollment: async () => {} });
    credential = (await query<{ encrypted_secret: string; last_step: string }>("SELECT encrypted_secret, last_step FROM admin_mfa_credentials WHERE user_id = $1", [user.id])).rows[0];
  }
  const secret = decryptMfaSecret(credential.encrypted_secret, env.authMfaEncryptionKey, user.id);
  let step = Math.max(Math.floor(Date.now() / 30_000), Number(credential.last_step) + 1);
  while (step > Math.floor(Date.now() / 30_000) + 1) {
    await delay(Math.min(30_000, (step - 1) * 30_000 - Date.now() + 10));
    step = Math.max(Math.floor(Date.now() / 30_000), Number(credential.last_step) + 1);
  }
  return { ...input, mfaCode: new TOTP({ secret: Secret.fromBase32(secret) }).generate({ timestamp: step * 30_000 }) };
}

export async function createTestAuthToken(actor: { id: string; email: string; fullName: string; role: UserRole }): Promise<string> {
  const input = await signinTestInput({ email: actor.email, password: "unused" });
  const credential = await verifyAdminSecondFactor(actor, input.mfaCode);
  return createAuthToken({ ...actor, adminSessionId: await createAdminSession(actor, credential) });
}
