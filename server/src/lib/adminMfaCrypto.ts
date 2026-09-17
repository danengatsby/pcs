import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Secret, TOTP } from "otpauth";

function encryptionKey(value: string): Buffer {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("Configurează AUTH_MFA_ENCRYPTION_KEY cu 32 de octeți aleatorii în format hexazecimal.");
  }
  return Buffer.from(value, "hex");
}

export function encryptMfaSecret(secret: string, key: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
  cipher.setAAD(Buffer.from(`pcs-admin-mfa:${userId}`));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptMfaSecret(sealed: string, key: string, userId: string): string {
  const [version, iv, tag, ciphertext, extra] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra) {
    throw new Error("Format MFA invalid.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(key), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(`pcs-admin-mfa:${userId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function createMfaEnrollment(email: string): { secret: string; uri: string } {
  const totp = new TOTP({ issuer: "PCS", label: email, algorithm: "SHA1", digits: 6, period: 30, secret: new Secret({ size: 20 }) });
  return { secret: totp.secret.base32, uri: totp.toString() };
}

export function validateMfaCode(secret: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) { return null; }
  const totp = new TOTP({ secret: Secret.fromBase32(secret), algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: code, timestamp: now, window: 1 });
  return delta === null ? null : Math.floor(now / 30_000) + delta;
}
