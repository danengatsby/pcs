import assert from "node:assert/strict";
import { test } from "node:test";
import { Secret, TOTP } from "otpauth";
import { createMfaEnrollment, decryptMfaSecret, encryptMfaSecret, validateMfaCode } from "../../lib/adminMfaCrypto.js";

test("MFA encryption binds secrets to their account and rejects tampering and wrong keys", () => {
  const enrollment = createMfaEnrollment("personal@example.test");
  const key = "ab".repeat(32);
  const sealed = encryptMfaSecret(enrollment.secret, key, "42");
  assert.ok(!sealed.includes(enrollment.secret));
  assert.equal(decryptMfaSecret(sealed, key, "42"), enrollment.secret);
  assert.throws(() => decryptMfaSecret(sealed, key, "43"));
  assert.throws(() => decryptMfaSecret(sealed, "cd".repeat(32), "42"));
  const parts = sealed.split("."); parts[2] = "A".repeat(parts[2].length);
  assert.throws(() => decryptMfaSecret(parts.join("."), key, "42"));
  assert.throws(() => encryptMfaSecret(enrollment.secret, "", "42"));
  assert.match(enrollment.uri, /^otpauth:\/\/totp\//);
});

test("TOTP validation matches RFC 6238 SHA1 vectors truncated to 6 digits and restricts clock drift", () => {
  const secret = Secret.fromUTF8("12345678901234567890");
  for (const [seconds, expected] of [[59, "287082"], [1111111109, "081804"], [1111111111, "050471"], [1234567890, "005924"], [2000000000, "279037"], [20000000000, "353130"]] as const) {
    assert.equal(validateMfaCode(secret.base32, expected, seconds * 1000), Math.floor(seconds / 30));
  }
  const now = 1234567890000;
  const totp = new TOTP({ secret });
  assert.notEqual(validateMfaCode(secret.base32, totp.generate({ timestamp: now - 30_000 }), now), null);
  assert.equal(validateMfaCode(secret.base32, totp.generate({ timestamp: now - 90_000 }), now), null);
  assert.equal(validateMfaCode(secret.base32, "12345", now), null);
});
