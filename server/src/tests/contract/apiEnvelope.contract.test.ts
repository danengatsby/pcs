import test from "node:test";
import assert from "node:assert/strict";
import { buildErrorEnvelope, buildSuccessEnvelope } from "../../lib/apiEnvelope.js";

test("api envelope: success should have stable shape", () => {
  const env = buildSuccessEnvelope("req-1", { ok: true });

  assert.deepEqual(Object.keys(env).sort(), ["data", "error", "meta"]);
  assert.equal(env.error, null);
  assert.deepEqual(env.data, { ok: true });

  assert.ok(env.meta);
  assert.equal(env.meta.requestId, "req-1");
  assert.equal(typeof env.meta.timestamp, "string");
  assert.ok(env.meta.timestamp.length > 10);
});

test("api envelope: error should have stable shape", () => {
  const env = buildErrorEnvelope("req-2", "AUTH_UNAUTHORIZED", "Token lipsa sau invalid.");

  assert.deepEqual(Object.keys(env).sort(), ["data", "error", "meta"]);
  assert.equal(env.data, null);

  assert.ok(env.error);
  assert.equal(env.error.code, "AUTH_UNAUTHORIZED");
  assert.equal(env.error.message, "Token lipsa sau invalid.");

  assert.ok(env.meta);
  assert.equal(env.meta.requestId, "req-2");
  assert.equal(typeof env.meta.timestamp, "string");
});
