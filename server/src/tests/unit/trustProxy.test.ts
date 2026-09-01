import assert from "node:assert/strict";
import test from "node:test";
import { parseTrustProxy } from "../../lib/trustProxy.js";

test("parseTrustProxy should parse booleans", () => {
  assert.equal(parseTrustProxy("true"), true);
  assert.equal(parseTrustProxy("false"), false);
});

test("parseTrustProxy should reject insecure numeric hop counts", () => {
  assert.throws(() => parseTrustProxy("1"), /IP sau CIDR/);
  assert.throws(() => parseTrustProxy("0"), /IP sau CIDR/);
});

test("parseTrustProxy should parse comma-separated values", () => {
  assert.deepEqual(parseTrustProxy("loopback, linklocal"), ["loopback", "linklocal"]);
});

test("parseTrustProxy should use fallback when value is missing", () => {
  assert.equal(parseTrustProxy(undefined, true), true);
  assert.equal(parseTrustProxy("", false), false);
});
