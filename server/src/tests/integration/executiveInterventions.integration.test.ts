import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { createFastifyServer } from "../../fastifyServer.js";
import { query } from "../../lib/db.js";
import { createAuthToken } from "../../lib/authToken.js";
import { adminCapabilities, type AdminAccessContext } from "../../lib/adminAuthorization.js";
import { readExecutiveInterventions } from "../../modules/executiveDashboard/interventions.repository.js";

test("executive interventions cover six live queues, exact time boundaries, scoped records and pagination", async () => {
  const prefix = `interventions-${randomUUID().slice(0, 8)}`;
  const orgs = [`${prefix}-a`, `${prefix}-b`, `${prefix}-unled`];
  const now = new Date("2026-10-10T12:00:00Z");
  const email = `${prefix}@example.test`;
  const app = createApp();
  const fastify = await createFastifyServer(); await fastify.ready();
  try {
    const actorId = (await query<{ id: string }>("INSERT INTO users (full_name, email, password_hash, role) VALUES ('Președinte intervenții', $1, 'unused', 'PRESEDINTE') RETURNING id", [email])).rows[0].id.toString();
    const actor = { id: actorId, email, fullName: "Președinte intervenții", role: "PRESEDINTE" as const };
    const token = await createAuthToken(actor);
    const baselineMissing = Number((await query<{ total: string }>("SELECT COUNT(*) AS total FROM member_documents WHERE status = 'published' AND expires_on IS NULL")).rows[0].total);
    for (const org of orgs) { await query("INSERT INTO organizations (id, code, name, level, status) VALUES ($1, $1, $1, 'county', 'active')", [org]); }
    await query("INSERT INTO organization_leadership_mandates (organization_id, user_id, full_name, position_title, started_at, ended_at, status) VALUES ($1, $2, 'Responsabil curent', 'Președinte', '2026-01-01', '2026-12-31', 'active'), ($3, NULL, 'Responsabil expirat', 'Secretar', '2025-01-01', '2026-10-09', 'active'), ($3, NULL, 'Responsabil viitor', 'Secretar', '2026-10-11', NULL, 'active')", [orgs[0], actorId, orgs[2]]);
    const volunteers = [
      ["old", "2026-10-01T12:00:00Z", "nou", null, orgs[0]],
      ["validated", "2026-10-08T11:59:59Z", "validat", null, orgs[0]],
      ["boundary", "2026-10-08T12:00:00Z", "nou", null, orgs[0]],
      ["contacted", "2026-10-01T12:00:00Z", "nou", now.toISOString(), orgs[0]],
      ["outside", "2026-10-01T12:00:00Z", "nou", null, orgs[1]],
    ];
    for (const [tag, created, status, contacted, org] of volunteers) {
      const address = `${prefix}-${tag}@example.test`;
      const v = (await query<{ id: string }>("INSERT INTO volunteers (full_name, email, phone, county, locality, skills, motivation, created_at, workflow_status, last_contact_at) VALUES ($1, $2, '', 'Cluj', 'Cluj-Napoca', '', '', $3, $4, $5) RETURNING id", [tag, address, created, status, contacted])).rows[0];
      await query("INSERT INTO membership_records (volunteer_id, full_name, email, organization_id) VALUES ($1, $2, $3, $4)", [v.id, tag, address, org]);
    }
    await query("INSERT INTO organization_objectives (organization_id, title, target_value, due_date, status) VALUES ($1, 'Obiectiv întârziat', 10, '2026-10-09', 'in_progress'), ($1, 'Obiectiv azi', 10, '2026-10-10', 'planned'), ($1, 'Obiectiv atins', 10, '2026-10-01', 'achieved'), ($2, 'Obiectiv extern', 10, '2026-10-01', 'planned')", [orgs[0], orgs[1]]);
    const event = (await query<{ id: string }>("INSERT INTO mobilization_actions (slug, action_type, title, summary, organization_id, starts_at) VALUES ($1, 'event', 'Eveniment fără coordonator', 'De organizat', $2, '2026-10-11T12:00:00Z') RETURNING id", [prefix, orgs[0]])).rows[0];
    // A closed action may still have reports awaiting validation.
    const task = (await query<{ id: string }>("INSERT INTO mobilization_actions (slug, action_type, title, summary, organization_id, status) VALUES ($1, 'volunteer_task', 'Sarcină raportată', 'De verificat', $2, 'closed') RETURNING id", [`${prefix}-task`, orgs[0]])).rows[0];
    await query("INSERT INTO mobilization_participants (action_id, full_name, email, status, reported_at, reviewed_at, hours) VALUES ($1, 'Raport nou', $2, 'reported', '2026-10-07T12:00:00Z', NULL, 3), ($1, 'Raport validat', $3, 'completed', '2026-10-07T12:00:00Z', '2026-10-08T12:00:00Z', 2)", [task.id, `${prefix}-report@example.test`, `${prefix}-reviewed@example.test`]);
    const decision = (await query<{ id: string }>("INSERT INTO organization_mandate_decisions (organization_id, decision_number, decision_date, issuing_body, minutes_path, created_by, expires_on) VALUES ($1, $2, '2026-01-01', 'Biroul teritorial', '/pv.pdf', $3, '2026-10-09') RETURNING id", [orgs[0], prefix, actorId])).rows[0];
    await query("INSERT INTO member_documents (title, category, path, expires_on) VALUES ('Document la limită', 'statutar', $1, '2026-11-09'), ('Document ulterior', 'statutar', $2, '2026-11-10'), ('Document fără termen', 'statutar', $3, NULL)", [`/${prefix}-boundary.pdf`, `/${prefix}-later.pdf`, `/${prefix}-unknown.pdf`]);
    for (const org of orgs.slice(0, 2)) {
      const congress = (await query<{ id: string }>("INSERT INTO congresses (organization_id, title, purpose, starts_at, ends_at, quorum, created_by) VALUES ($1, 'Congres cu decizie', 'ordinary', NOW(), NOW() + INTERVAL '1 day', 1, $2) RETURNING id", [org, actorId])).rows[0];
      await query("INSERT INTO congress_decisions (congress_id, decision_type, decision_text, created_by, expires_on) VALUES ($1, 'minutes', 'Decizie cu termen explicit', $2, '2026-10-24')", [congress.id, actorId]);
      const arbitration = (await query<{ id: string }>("INSERT INTO arbitration_cases (case_number, organization_id, case_type, subject, facts, filed_by) VALUES ($1, $1, 'other', 'Dosar cu decizie', 'Date pentru verificarea termenului.', $2) RETURNING id", [org, actorId])).rows[0];
      await query("INSERT INTO arbitration_decisions (case_id, decided_by, outcome, reasoning, expires_on) VALUES ($1, $2, 'upheld', 'Decizie motivată cu termen explicit.', '2026-10-15')", [arbitration.id, actorId]);
    }
    const scope = { national: false, organizationIds: [orgs[0], orgs[2]], mandateOrganizationIds: [orgs[0]], countyIds: [], countyNames: [], localities: [] };
    const access: AdminAccessContext = { actor, capability: "executive.read", capabilities: [...adminCapabilities], scope };
    const data = await readExecutiveInterventions(access, { limit: 100, offset: 0 }, now);
    assert.deepEqual(data.counts, { uncontacted: 2, unled_branches: 1, overdue_objectives: 1, uncoordinated_events: 1, unreviewed_reports: 1, expiring_records: 3 });
    assert.equal(data.total, 9);
    assert.equal(data.rows[0].priority, "critical");
    assert.ok(data.rows.every((row) => !row.title.includes("outside") && !row.title.includes("extern")));
    assert.equal(data.rows.find((row) => row.kind === "uncoordinated_events")?.href, `/admin/mobilization?action=${event.id}`);
    const reports = data.rows.find((row) => row.kind === "unreviewed_reports");
    assert.match(reports!.href, /participant=\d+#participant-/);
    const page1 = await readExecutiveInterventions(access, { limit: 2, offset: 0 }, now);
    const page2 = await readExecutiveInterventions(access, { limit: 2, offset: 2 }, now);
    assert.equal(page1.total, 9); assert.equal(page2.total, 9);
    assert.equal(new Set([...page1.rows, ...page2.rows].map((row) => row.key)).size, 4);
    const empty = await readExecutiveInterventions(access, { limit: 2, offset: 100 }, now);
    assert.equal(empty.total, 9); assert.equal(empty.rows.length, 0);
    const restricted = await readExecutiveInterventions({ ...access, capabilities: ["executive.read"] }, { limit: 100, offset: 0 }, now);
    assert.equal(restricted.total, 0); assert.deepEqual(restricted.counts, { expiring_records: 0 });
    const national = await readExecutiveInterventions({ ...access, scope: { ...scope, national: true } }, { kind: "expiring_records", limit: 100, offset: 0 }, now);
    assert.equal(national.total, 6);
    assert.equal(national.expiryCoverage.missing, baselineMissing + 1);
    assert.equal(national.expiryCoverage.tracked, 7);

    for (const server of [app, fastify.server]) {
      await request(server).get("/api/admin/executive-dashboard/interventions").expect(401);
      const response = await request(server).get("/api/admin/executive-dashboard/interventions?limit=1").set("Authorization", `Bearer ${token}`).expect(200);
      assert.equal(response.body.data.rows.length, 1);
      assert.equal(response.headers["cache-control"], "private, no-store");
      await request(server).get("/api/admin/executive-dashboard/interventions?kind=invalid").set("Authorization", `Bearer ${token}`).expect(400);
      await request(server).get("/api/admin/executive-dashboard/interventions?offset=-1").set("Authorization", `Bearer ${token}`).expect(400);
    }
    const expiryUrl = `/api/admin/executive-dashboard/expirations/mandate_decision/${decision.id}`;
    await request(app).patch(expiryUrl).set("Authorization", `Bearer ${token}`).send({ expiresOn: '2026-12-01', expectedExpiresOn: '2026-10-09' }).expect(200);
    await request(app).patch(expiryUrl).set("Authorization", `Bearer ${token}`).send({ expiresOn: null, expectedExpiresOn: '2026-10-09' }).expect(409);
    await request(app).patch(expiryUrl).set("Authorization", `Bearer ${token}`).send({ expiresOn: '2026-02-30', expectedExpiresOn: '2026-12-01' }).expect(400);
    await query("UPDATE volunteers SET last_contact_at = NOW() WHERE email LIKE $1", [`${prefix}%`]);
    await query("UPDATE organization_objectives SET status = 'achieved' WHERE organization_id = $1", [orgs[0]]);
    await request(app).patch(`/api/admin/mobilization/actions/${event.id}`).set("Authorization", `Bearer ${token}`).send({ coordinatorUserId: actorId, expectedVersion: 1 }).expect(200);
    await query("UPDATE mobilization_participants SET status = 'completed', reviewed_at = NOW() WHERE action_id = $1", [task.id]);
    await query("UPDATE congress_decisions SET expires_on = '2026-12-01' WHERE congress_id IN (SELECT id FROM congresses WHERE organization_id = $1)", [orgs[0]]);
    await query("UPDATE arbitration_decisions SET expires_on = '2026-12-01' WHERE case_id IN (SELECT id FROM arbitration_cases WHERE organization_id = $1)", [orgs[0]]);
    const resolved = await readExecutiveInterventions(access, { limit: 100, offset: 0 }, now);
    assert.equal(resolved.total, 1); assert.equal(resolved.rows[0].kind, "unled_branches");
    await query("UPDATE users SET role = 'CONSILIER' WHERE id = $1", [actorId]);
    for (const server of [app, fastify.server]) {
      await request(server).get("/api/admin/executive-dashboard/interventions").set("Authorization", `Bearer ${token}`).expect(403);
      await request(server).patch(expiryUrl).set("Authorization", `Bearer ${token}`).send({ expiresOn: null, expectedExpiresOn: '2026-12-01' }).expect(403);
    }
  } finally {
    await fastify.close();
    await query("DELETE FROM mobilization_actions WHERE organization_id = ANY($1::varchar[])", [orgs]);
    await query("DELETE FROM membership_records WHERE organization_id = ANY($1::varchar[])", [orgs]);
    await query("DELETE FROM volunteers WHERE email LIKE $1", [`${prefix}%`]);
    await query("DELETE FROM organization_mandate_decisions WHERE organization_id = ANY($1::varchar[])", [orgs]);
    await query("DELETE FROM congresses WHERE organization_id = ANY($1::varchar[])", [orgs]);
    await query("DELETE FROM arbitration_cases WHERE organization_id = ANY($1::varchar[])", [orgs]);
    await query("DELETE FROM member_documents WHERE path LIKE $1", [`/${prefix}%`]);
    await query("DELETE FROM organizations WHERE id = ANY($1::varchar[])", [orgs]);
    await query("DELETE FROM users WHERE email = $1", [email]);
  }
});
