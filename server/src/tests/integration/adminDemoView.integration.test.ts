import { signinTestInput } from "../helpers/adminAuth.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query, closePool } from "../../lib/db.js";
import { closePrisma } from "../../lib/prisma.js";
import { env } from "../../lib/env.js";
import { deleteUserByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();
after(async () => { await Promise.all([closePool(), closePrisma()]); });

test("authenticated demo view reads a separate database, filters and paginates without modifying real members", {
  skip: !env.adminDemoDatabaseUrl,
}, async () => {
  const email = `demo-view.${randomUUID()}@example.test`;
  const password = "ParolaTest#2026";
  try {
    await request(app).get("/api/admin/members/dashboard?dataset=demo").expect(401);
    await request(app).post("/api/auth/signup").send({ fullName: "Titular Test", email, password }).expect(201);
    const regular = await request(app).post("/api/auth/signin").send({ email, password }).expect(200);
    await request(app).get("/api/admin/members/dashboard?dataset=demo").auth(regular.body.data.token, { type: "bearer" }).expect(403);
    await query("UPDATE users SET role='PRESEDINTE' WHERE email=$1", [email]);
    const signed = await request(app).post("/api/auth/signin").send(await signinTestInput({ email, password })).expect(200);
    const token = signed.body.data.token as string;
    const realBefore = (await query("SELECT id::text, status, version FROM membership_records ORDER BY id")).rows;
    const read = async (queryString: string) => (await request(app).get(`/api/admin/members/dashboard?${queryString}`).auth(token, { type: "bearer" }).expect(200)).body.data;
    const real = await read("search=admin-demo.example.test");
    assert.equal(real.dataset, "real");
    assert.equal(real.demoAvailable, true);
    assert.equal(real.pagination.total, 0);
    const demo = await read("dataset=demo&limit=25");
    assert.equal(demo.dataset, "demo");
    assert.equal(demo.summary.total, 60);
    assert.equal(demo.pagination.total, 60);
    assert.equal(demo.rows.length, 25);
    assert.equal(demo.organizations.length, 7);
    for (const row of demo.rows) {
      assert.match(row.id, /^demo:\d+$/);
      assert.match(row.fullName, /\(Demo\)$/);
      assert.match(row.email, /@admin-demo\.example\.test$/);
      assert.equal(row.userId, null);
      assert.equal(row.volunteerId, null);
      assert.deepEqual(row.availableActions, []);
    }
    const second = await read("dataset=demo&limit=25&offset=25");
    assert.equal(second.rows.length, 25);
    const ids = new Set(demo.rows.map((row: { id: string }) => row.id));
    assert.ok(second.rows.every((row: { id: string }) => !ids.has(row.id)));
    const searched = await read(`dataset=demo&search=${encodeURIComponent(demo.rows[0].email)}`);
    assert.equal(searched.pagination.total, 1);
    const filtered = await read(`dataset=demo&organizationId=${encodeURIComponent(demo.rows[0].organization.id)}&status=active`);
    assert.ok(filtered.rows.length > 0);
    assert.ok(filtered.rows.every((row: { organization: { id: string } }) => row.organization.id === demo.rows[0].organization.id));
    await request(app).post(`/api/admin/members/${encodeURIComponent(demo.rows[0].id)}/actions`).auth(token, { type: "bearer" })
      .send({ action: "suspend", expectedVersion: demo.rows[0].version, reason: "Acțiune demo interzisă" }).expect(400);
    await request(app).get("/api/admin/members/dashboard?dataset=invalid").auth(token, { type: "bearer" }).expect(400);
    const configuredUrl = env.adminDemoDatabaseUrl;
    try {
      env.adminDemoDatabaseUrl = "";
      await request(app).get("/api/admin/members/dashboard?dataset=demo").auth(token, { type: "bearer" }).expect(503);
      assert.equal((await read("dataset=real")).demoAvailable, false);
    } finally { env.adminDemoDatabaseUrl = configuredUrl; }
    assert.deepEqual((await query("SELECT id::text, status, version FROM membership_records ORDER BY id")).rows, realBefore);
  } finally { await deleteUserByEmail(email); }
});
