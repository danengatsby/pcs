import assert from "node:assert/strict";
import { test } from "node:test";
import { signinSchema } from "../../modules/auth/validation.js";

test("signin accepts a username without requiring an email address", () => {
  const result = signinSchema.safeParse({
    email: "admin",
    password: "ParolaSigura#2026",
  });

  assert.equal(result.success, true);
});

test("signin continues to accept a complete email address", () => {
  const result = signinSchema.safeParse({
    email: "admin@example.test",
    password: "ParolaSigura#2026",
  });

  assert.equal(result.success, true);
});

test("signin rejects an invalid identifier", () => {
  const result = signinSchema.safeParse({
    email: "admin cont",
    password: "ParolaSigura#2026",
  });

  assert.equal(result.success, false);
});
