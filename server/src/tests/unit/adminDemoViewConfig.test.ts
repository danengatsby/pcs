import assert from "node:assert/strict";
import { test } from "node:test";
import { readAdminDemoDatabaseUrl } from "../../lib/env/adminDemoViewConfig.js";

const primary = "postgres://app:secret@localhost/pcs_db";
test("demo view accepts a separate demo database in production without enabling production seeding", () => {
  const demo = "postgres://reader:secret@localhost/pcs_members_demo";
  assert.equal(readAdminDemoDatabaseUrl(demo, primary, "production"), demo);
  assert.equal(readAdminDemoDatabaseUrl(undefined, primary, "production"), "");
});

test("demo view rejects real databases, reused databases and malformed URLs without revealing credentials", () => {
  for (const url of [primary, "not-a-url", "https://reader:private@host/pcs_demo", "postgres://reader:private@host/pcs_members"]) {
    assert.throws(() => readAdminDemoDatabaseUrl(url, primary, "production"), error => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes("private"));
      assert.ok(!error.message.includes("secret"));
      return true;
    });
  }
  const demo = "postgres://reader:secret@localhost/pcs_demo";
  assert.throws(() => readAdminDemoDatabaseUrl(demo, demo, "production"));
  assert.throws(() => readAdminDemoDatabaseUrl(demo, primary, "test"));
  assert.equal(readAdminDemoDatabaseUrl(`${demo}_test`, primary, "test"), `${demo}_test`);
});
