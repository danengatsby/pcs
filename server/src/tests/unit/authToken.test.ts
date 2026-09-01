import assert from "node:assert/strict";
import test from "node:test";
import { createAuthToken, readBearerToken, verifyAuthToken } from "../../lib/authToken.js";
import { env } from "../../lib/env.js";

test("createAuthToken and verifyAuthToken should roundtrip user payload", async () => {
  const token = await createAuthToken({
    id: "42",
    fullName: "Test User",
    email: "test@example.com",
    role: "MEMBRU",
  });

  const payload = await verifyAuthToken(token);
  assert.ok(payload);
  assert.equal(payload.sub, "42");
  assert.equal(payload.role, "MEMBRU");
  assert.equal(payload.email, "test@example.com");
  assert.equal(payload.iss, env.authTokenIssuer);
  assert.equal(payload.aud, env.authTokenAudience);
  assert.equal(typeof payload.jti, "string");
  assert.ok(payload.jti.length > 10);
});

test("verifyAuthToken should reject a tampered token", async () => {
  const token = await createAuthToken({
    id: "11",
    fullName: "User",
    email: "user@example.com",
    role: "ADERENT",
  });

  const parts = token.split(".");
  assert.equal(parts.length, 3);
  const signature = parts[2]!;
  const tamperedSignature = `${signature.startsWith("a") ? "b" : "a"}${signature.slice(1)}`;
  const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

  assert.equal(await verifyAuthToken(tamperedToken), null);
});

test("readBearerToken should parse valid authorization headers", () => {
  assert.equal(readBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
  assert.equal(readBearerToken("bearer token-value"), "token-value");
  assert.equal(readBearerToken("Basic abc123"), null);
  assert.equal(readBearerToken(undefined), null);
});
