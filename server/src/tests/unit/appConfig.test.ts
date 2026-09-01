import assert from "node:assert/strict";
import test from "node:test";
import { readBindHost } from "../../lib/env/appConfig.js";

test("readBindHost uses a loopback default in production", () => {
  const previous = process.env.BIND_HOST;
  delete process.env.BIND_HOST;

  try {
    assert.equal(readBindHost("production"), "127.0.0.1");
  } finally {
    if (previous === undefined) {
      delete process.env.BIND_HOST;
    } else {
      process.env.BIND_HOST = previous;
    }
  }
});

test("readBindHost keeps a development server reachable", () => {
  const previous = process.env.BIND_HOST;
  delete process.env.BIND_HOST;

  try {
    assert.equal(readBindHost("development"), "0.0.0.0");
  } finally {
    if (previous === undefined) {
      delete process.env.BIND_HOST;
    } else {
      process.env.BIND_HOST = previous;
    }
  }
});

test("readBindHost rejects hostnames and malformed values", () => {
  const previous = process.env.BIND_HOST;
  process.env.BIND_HOST = "localhost/path";

  try {
    assert.throws(() => readBindHost("production"), /BIND_HOST invalid/);
  } finally {
    if (previous === undefined) {
      delete process.env.BIND_HOST;
    } else {
      process.env.BIND_HOST = previous;
    }
  }
});
