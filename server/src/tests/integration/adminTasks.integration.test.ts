import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { createFastifyServer } from "../../fastifyServer.js";
import { query } from "../../lib/db.js";
import { createAuthToken } from "../../lib/authToken.js";
import { buildAdminAccessContext } from "../../lib/adminAuthorization.js";
import { readAdminTasks } from "../../modules/admin/handlers/getAdminTasks.js";

test("administrative tasks enforce capabilities, territory, complete counts and current workflow on both adapters", async () => {
  const suffix = randomUUID().slice(0, 8);
  const organizations = [`tasks-${suffix}-a`, `tasks-${suffix}-b`];
  const email = `tasks-${suffix}@example.test`;
  const app = createApp();
  const fastify = await createFastifyServer();
  await fastify.ready();
  let userId = "";
  try {
    userId = (await query<{ id: string }>("INSERT INTO users (full_name, email, password_hash, role) VALUES ('Secretar sarcini', $1, 'unused', 'SECRETAR') RETURNING id", [email])).rows[0].id.toString();
    const actor = { id: userId, fullName: "Secretar sarcini", email, role: "SECRETAR" as const };
    const token = await createAuthToken(actor);
    for (const server of [app, fastify.server]) {
      await request(server).get("/api/admin/tasks").expect(401);
      await request(server).get("/api/admin/tasks").set("Authorization", `Bearer ${token}`).expect(403);
    }
    for (const org of organizations) {
      await query("INSERT INTO organizations (id, code, level, name, county, status) VALUES ($1, $1, 'county', $1, 'Cluj', 'active')", [org]);
      await query("INSERT INTO organization_territories (organization_id, territory_type, county_id, locality) SELECT $1, 'county', id, '' FROM counties WHERE name = 'Cluj'", [org]);
    }
    await query("INSERT INTO organization_leadership_mandates (organization_id, user_id, full_name, position_title, started_at, status) VALUES ($1, $2, 'Secretar sarcini', 'Secretar', CURRENT_DATE, 'active')", [organizations[0], userId]);
    for (const org of organizations) {
      // Same county, different assigned organization: geography must not override membership ownership.
      const volunteer = (await query<{ id: string }>("INSERT INTO volunteers (full_name, email, phone, county, locality, skills, motivation) VALUES ('Dosar privat', $1, '0712345678', 'Cluj', 'Cluj-Napoca', '', '') RETURNING id", [`${org}@example.test`])).rows[0];
      await query("INSERT INTO membership_records (volunteer_id, full_name, email, organization_id) VALUES ($1, 'Dosar privat', $2, $3)", [volunteer.id, `${org}@example.test`, org]);
      await query("INSERT INTO organization_objectives (organization_id, title, target_value, due_date, status) VALUES ($1, 'Obiectiv restant', 10, CURRENT_DATE - 1, 'planned'), ($1, 'Obiectiv încheiat', 10, CURRENT_DATE - 1, 'achieved')", [org]);
      await query("INSERT INTO congresses (organization_id, title, purpose, starts_at, ends_at, quorum, created_by, status) SELECT $1, 'Congres de verificat', 'ordinary', NOW(), NOW() + INTERVAL '1 day', 1, $2, 'closed' FROM generate_series(1, 55)", [org, userId]);
      await query("INSERT INTO congresses (organization_id, title, purpose, starts_at, ends_at, quorum, created_by, status) VALUES ($1, 'Congres finalizat', 'ordinary', NOW(), NOW() + INTERVAL '1 day', 1, $2, 'validated')", [org, userId]);
      await query("INSERT INTO arbitration_cases (case_number, organization_id, case_type, subject, facts, filed_by, status) VALUES ($1, $2, 'other', 'Sesizare privată', 'Fapte pentru un dosar confidențial.', $3, 'submitted')", [org, org, userId]);
      const actionId = (await query<{ id: string }>("INSERT INTO mobilization_actions (slug, action_type, title, summary, organization_id) VALUES ($1, 'volunteer_task', 'Sarcini de verificat', 'Test', $1) RETURNING id", [org])).rows[0].id;
      await query("INSERT INTO mobilization_participants (action_id, full_name, email, status) VALUES ($1, 'În așteptare', $2, 'waitlisted'), ($1, 'Finalizat', $3, 'completed')", [actionId, `${org}-waiting@example.test`, `${org}-done@example.test`]);
    }
    await query("INSERT INTO arbitration_cases (case_number, case_type, subject, facts, filed_by) VALUES ($1, 'other', 'Dosar național', 'Nu este vizibil în mandatul local.', $2)", [`national-${suffix}`, userId]);
    const scopedAccess = await buildAdminAccessContext(actor, "recruitment.read");
    const expected = { volunteers: 1, members: 1, organizations: 1, mobilization: 1, congresses: 55, arbitration: 1 };
    for (const server of [app, fastify.server]) {
      const response = await request(server).get("/api/admin/tasks").set("Authorization", `Bearer ${token}`).expect(200);
      assert.deepEqual(response.body.data.counts, expected);
      assert.equal(response.body.data.total, 60);
      assert.equal(response.headers["cache-control"], "private, no-store");
      assert.doesNotMatch(response.text, /Dosar privat|Sesizare privată|example\.test|0712345678/);
    }
    const restricted = await readAdminTasks({ ...scopedAccess, capabilities: ["congress.read"] });
    assert.deepEqual(restricted.counts, { congresses: 55 });
    assert.equal(restricted.total, 55);
    const national = await readAdminTasks({ ...scopedAccess, scope: { ...scopedAccess.scope, national: true }, capabilities: ["congress.read", "arbitration.read"] });
    assert.equal(national.counts.congresses, 110);
    assert.equal(national.counts.arbitration, 3);
    await query("UPDATE congresses SET status = 'validated' WHERE organization_id = $1", [organizations[0]]);
    await query("UPDATE arbitration_cases SET status = 'decided' WHERE organization_id = $1", [organizations[0]]);
    const updated = await request(app).get("/api/admin/tasks").set("Authorization", `Bearer ${token}`).expect(200);
    assert.equal(updated.body.data.counts.congresses, 0);
    assert.equal(updated.body.data.counts.arbitration, 0);
    // Revoking the mandate blocks both capabilities and counts, even with the existing token.
    await query("UPDATE organization_leadership_mandates SET status = 'suspended' WHERE user_id = $1", [userId]);
    for (const server of [app, fastify.server]) {
      await request(server).get("/api/admin/access").set("Authorization", `Bearer ${token}`).expect(403);
      await request(server).get("/api/admin/tasks").set("Authorization", `Bearer ${token}`).expect(403);
    }
  } finally {
    await fastify.close();
    await query("DELETE FROM arbitration_cases WHERE filed_by = $1", [userId || null]);
    await query("DELETE FROM congresses WHERE organization_id = ANY($1::varchar[])", [organizations]);
    await query("DELETE FROM mobilization_actions WHERE organization_id = ANY($1::varchar[])", [organizations]);
    await query("DELETE FROM membership_records WHERE organization_id = ANY($1::varchar[])", [organizations]);
    await query("DELETE FROM volunteers WHERE email = ANY($1::varchar[])", [organizations.map((org) => `${org}@example.test`)]);
    await query("DELETE FROM organizations WHERE id = ANY($1::varchar[])", [organizations]);
    await query("DELETE FROM users WHERE email = $1", [email]);
  }
});
