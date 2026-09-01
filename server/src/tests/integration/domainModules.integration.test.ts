import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";

const app = createApp();

test("domain modules should expose enterprise list endpoints", async () => {
  const [finance, organizations, elections] = await Promise.all([
    request(app).get("/api/finance?limit=5").expect(200),
    request(app).get("/api/organizations?limit=5").expect(200),
    request(app).get("/api/elections?limit=5").expect(200),
  ]);

  const financeRows = finance.body?.data as unknown;
  const organizationsRows = organizations.body?.data as unknown;
  const electionsRows = elections.body?.data as unknown;

  assert.ok(Array.isArray(financeRows));
  assert.ok(Array.isArray(organizationsRows));
  assert.ok(Array.isArray(electionsRows));

  assert.equal(typeof finance.body?.meta?.total, "number");
  assert.equal(typeof organizations.body?.meta?.total, "number");
  assert.equal(typeof elections.body?.meta?.total, "number");
});
