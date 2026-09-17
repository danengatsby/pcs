import assert from "node:assert/strict";
import { test } from "node:test";
import { readAuthMfaEncryptionKey } from "../../lib/env/authConfig.js";
import { assertAdminDemoEnvironment } from "../../lib/adminDemoPolicy.js";
import { defaultAdminCapabilities, profileCapabilities } from "../../lib/adminAccessProfiles.js";

test("production requires a separate MFA encryption key; legacy public-admin config cannot enable access", () => {
  const previous = process.env.AUTH_MFA_ENCRYPTION_KEY;
  try {
    delete process.env.AUTH_MFA_ENCRYPTION_KEY;
    assert.throws(() => readAuthMfaEncryptionKey("production"), /obligatorie/);
    assert.equal(readAuthMfaEncryptionKey("development"), "");
    assert.equal(readAuthMfaEncryptionKey("test").length, 64);
    process.env.AUTH_MFA_ENCRYPTION_KEY = "not-a-key";
    assert.throws(() => readAuthMfaEncryptionKey("test"), /64/);
    process.env.AUTH_MFA_ENCRYPTION_KEY = "ab".repeat(32);
    assert.equal(readAuthMfaEncryptionKey("production"), "ab".repeat(32));
  } finally {
    if (previous === undefined) { delete process.env.AUTH_MFA_ENCRYPTION_KEY; }
    else { process.env.AUTH_MFA_ENCRYPTION_KEY = previous; }
  }
});

test("demo mode requires a separate non-production database and disabled email delivery", () => {
  const base = { nodeEnv: "development", databaseUrl: "postgres://localhost/pcs_demo", enabled: true, emailNotificationsEnabled: false };
  assert.doesNotThrow(() => assertAdminDemoEnvironment(base));
  assert.throws(() => assertAdminDemoEnvironment({ ...base, nodeEnv: "production" }), /interzis/);
  assert.throws(() => assertAdminDemoEnvironment({ ...base, databaseUrl: "postgres://localhost/pcs_db" }), /dedicată/);
  assert.throws(() => assertAdminDemoEnvironment({ ...base, emailNotificationsEnabled: true }), /EMAIL_NOTIFICATIONS_ENABLED/);
  assert.doesNotThrow(() => assertAdminDemoEnvironment({ ...base, nodeEnv: "test", databaseUrl: "postgres://localhost/pcs_test" }));
});

test("political leadership does not imply confidential arbitration access", () => {
  for (const role of ["PRESEDINTE", "VICEPRESEDINTE", "SECRETAR", "CONSILIER"] as const) {
    assert.ok(!defaultAdminCapabilities(role).some((item) => item.startsWith("arbitration.")));
  }
  assert.ok(profileCapabilities.arbitration.includes("arbitration.adjudicate"));
  for (const profile of ["treasury", "parliamentary", "communications", "arbitration"] as const) {
    assert.ok(!profileCapabilities[profile].includes("recruitment.read"));
    assert.ok(!profileCapabilities[profile].includes("membership.read"));
  }
});
