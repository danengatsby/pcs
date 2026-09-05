import assert from "node:assert/strict";
import { test } from "node:test";
import { readAuthPublicAdminEmail } from "../../lib/env/authConfig.js";

test("public admin access defaults to disabled and requires a complete configured email", () => {
  const original = process.env.AUTH_PUBLIC_ADMIN_EMAIL;
  try {
    delete process.env.AUTH_PUBLIC_ADMIN_EMAIL;
    assert.equal(readAuthPublicAdminEmail(), "");
    process.env.AUTH_PUBLIC_ADMIN_EMAIL = "   ";
    assert.equal(readAuthPublicAdminEmail(), "");
    process.env.AUTH_PUBLIC_ADMIN_EMAIL = " Admin@Example.Test ";
    assert.equal(readAuthPublicAdminEmail(), "admin@example.test");
    for (const invalid of ["admin", "admin@", "admin@example.test,other@example.test", "a".repeat(180) + "@example.test"]) {
      process.env.AUTH_PUBLIC_ADMIN_EMAIL = invalid;
      assert.throws(readAuthPublicAdminEmail, /AUTH_PUBLIC_ADMIN_EMAIL/);
    }
  } finally {
    if (original === undefined) {
      delete process.env.AUTH_PUBLIC_ADMIN_EMAIL;
    } else {
      process.env.AUTH_PUBLIC_ADMIN_EMAIL = original;
    }
  }
});
