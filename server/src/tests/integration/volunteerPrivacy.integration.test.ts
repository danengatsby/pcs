import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../app.js";
import { createFastifyServer } from "../../fastifyServer.js";
import { query } from "../../lib/db.js";
import { buildTestEmail, deleteUserByEmail, deleteVolunteerByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();
let fastify: FastifyInstance;
before(async () => {
  fastify = await createFastifyServer();
  await fastify.ready();
});
after(async () => { await fastify.close(); });

test("both adapters expose no public volunteer directory, profiles or county counts even when records exist", async () => {
  const email = buildTestEmail("private-volunteer");
  try {
    await query(`
      INSERT INTO volunteers (full_name, email, phone, county, locality, skills, motivation)
      VALUES ('Persoana privata', $1, '0712345678', 'Cluj', 'Cluj-Napoca', 'organizare', 'Test privat')
    `, [email]);
    for (const target of [app, fastify.server]) {
      for (const path of ["/api/volunteers", "/api/volunteers/", "/api/volunteers?limit=1000",
        "/api/volunteers/by-county", "/api/volunteers/by-county?county=Cluj", "/api/volunteers/1"]) {
        const response = await request(target).get(path).expect(404);
        assert.equal(response.body.data, null);
        assert.equal(response.body.error.code, "API_ROUTE_NOT_FOUND");
        assert.doesNotMatch(response.text, /Persoana privata|0712345678|protejata|ascuns\+/);
        await request(target).head(path).expect(404);
      }
      await request(target).get("/api/admin/volunteers").expect(401);
      await request(target).get("/api/admin/volunteers/export.csv").expect(401);
      const counties = await request(target).get("/api/meta/counties").expect(200);
      assert.ok(counties.body.data.every((county: unknown) => typeof county === "string"));
    }
  } finally { await deleteVolunteerByEmail(email); }
});

test("public volunteer snapshots suppress small groups and round larger totals without raw-count metadata", async () => {
  const approverEmail = buildTestEmail("private-stats-approver");
  try {
    const approver = (await query<{ id: string }>(`
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES ('Aprobator statistici', $1, 'unused', 'PRESEDINTE') RETURNING id
    `, [approverEmail])).rows[0];
    await query("DELETE FROM public_indicators WHERE key IN ('volunteers', 'news')");
    await query(`
      INSERT INTO public_indicators (key, value, calculated_at, approved_at, approved_by)
      VALUES ('volunteers', 0, NOW(), NOW(), $1), ('news', 4, NOW(), NOW(), $1)
    `, [approver.id]);
    const cases: Array<[number, number | null]> = [
      [0, null], [1, null], [9, null], [10, 10], [17, 10], [19, 10], [20, 20], [1264, 1260],
      [Number.MAX_SAFE_INTEGER + 1, null],
    ];
    for (const [raw, published] of cases) {
      await query("UPDATE public_indicators SET value = $1 WHERE key = 'volunteers'", [raw]);
      for (const target of [app, fastify.server]) {
        const response = await request(target).get("/api/stats").expect(200);
        assert.deepEqual(response.body.data, { volunteers: published, news: 4 });
        assert.deepEqual(Object.keys(response.body.meta).sort(), ["requestId", "timestamp", "volunteerStatistics"]);
        assert.deepEqual(response.body.meta.volunteerStatistics, {
          scope: "national", minimumGroupSize: 10, roundingStep: 10, rounding: "down",
        });
      }
    }
    await query("UPDATE public_indicators SET value = 1264, approved_at = NULL WHERE key = 'volunteers'");
    const unapproved = await request(app).get("/api/stats").expect(200);
    assert.deepEqual(unapproved.body.data, { volunteers: null, news: 4 });
  } finally {
    await query("DELETE FROM public_indicators WHERE key IN ('volunteers', 'news')");
    await deleteUserByEmail(approverEmail);
  }
});

test("public statistics reject cohort and date filters on both adapters", async () => {
  for (const target of [app, fastify.server]) {
    for (const filters of ["county=Cluj", "role=MEMBRU", "status=activ", "search=ana", "from=2026-01-01&to=2026-02-01"]) {
      const response = await request(target).get(`/api/stats?${filters}`).expect(400);
      assert.equal(response.body.data, null);
      assert.equal(response.body.error.code, "BAD_REQUEST");
    }
  }
});
