import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeTestDatabase } from "../../lib/testDatabaseSafety.js";

test("test database safety is a no-op outside the test environment", () => {
  assert.doesNotThrow(() => {
    assertSafeTestDatabase({
      nodeEnv: "production",
      databaseUrl: "postgresql://app:secret@db:5432/pcp",
      testDatabaseUrl: "",
    });
  });
});

test("test database safety requires an explicit TEST_DATABASE_URL", () => {
  assert.throws(
    () => {
      assertSafeTestDatabase({
        nodeEnv: "test",
        databaseUrl: "postgresql://app:secret@db:5432/pcp",
        testDatabaseUrl: "",
      });
    },
    /TEST_DATABASE_URL explicit/
  );
});

test("test database safety rejects a database without a test marker", () => {
  const databaseUrl = "postgresql://app:secret@db:5432/pcp";
  assert.throws(
    () => {
      assertSafeTestDatabase({
        nodeEnv: "test",
        databaseUrl,
        testDatabaseUrl: databaseUrl,
      });
    },
    /segmentul 'test' sau 'testing'/
  );
});

test("test database safety accepts an explicitly configured test database", () => {
  const databaseUrl = "postgresql://app:secret@db:5432/pcp_test";
  assert.doesNotThrow(() => {
    assertSafeTestDatabase({
      nodeEnv: "test",
      databaseUrl,
      testDatabaseUrl: databaseUrl,
    });
  });
});
