import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { createFastifyServer } from "../../fastifyServer.js";
import { query } from "../../lib/db.js";
import { manageAdminSecurity } from "../../lib/adminSecurityManagement.js";
import { signinTestInput } from "../helpers/adminAuth.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";

const password = "ParolaPersonala#2026";
const treasuryPath = "/api/admin/treasury/entries";
const parliamentaryPath = "/api/admin/parliamentary/items";
const officer = async (app: Parameters<typeof request>[0], profile: "treasury" | "parliamentary", emails: string[], role = "PRESEDINTE") => {
  const email = buildTestEmail(profile); emails.push(email);
  await request(app).post("/api/auth/signup").send({ email, password, fullName: `Responsabil ${profile}` }).expect(201);
  await query("UPDATE users SET role = $2 WHERE email = $1", [email, role]);
  await manageAdminSecurity({ email, operator: "operator@example.test", reason: "Desemnare verificată pentru testul registrelor", action: "set-profile", profile });
  const result = await request(app).post("/api/auth/signin").send(await signinTestInput({ email, password })).expect(200);
  return { id: result.body.data.user.id as string, headers: { Authorization: `Bearer ${result.body.data.token}` } };
};
const entry = (description: string, amount = "10.10") => ({ requestId: randomUUID(), organizationId: null, kind: "income", category: "other", amount, occurredOn: "2026-09-06", description, reference: `DOC-${description}` });

for (const adapter of ["express", "fastify"] as const) {
  test(`${adapter}: treasury enforces private profiles, exact totals, idempotency, immutable confirmation, concurrency and named audit`, async () => {
    const fastify = adapter === "fastify" ? await createFastifyServer() : null;
    await fastify?.ready();
    const app = fastify?.server ?? createApp();
    const emails: string[] = [];
    const prefix = `TREAS-${randomUUID()}`;
    try {
      const treasurer = await officer(app, "treasury", emails);
      const parliamentarian = await officer(app, "parliamentary", emails);
      await request(app).get(treasuryPath).expect(401);
      await request(app).get(treasuryPath).set(parliamentarian.headers).expect(403);
      await request(app).get(parliamentaryPath).set(treasurer.headers).expect(403);
      await request(app).get("/api/admin/volunteers").set(treasurer.headers).expect(403);
      await request(app).get(`${treasuryPath}?limit=101`).set(treasurer.headers).expect(400);
      for (const amount of ["0", "-1", "1.001", "1e3", "NaN", "1000000000.00"]) {
        await request(app).post(treasuryPath).set(treasurer.headers).send(entry(prefix, amount)).expect(400);
      }
      await request(app).post(treasuryPath).set(treasurer.headers).send({ ...entry(prefix), occurredOn: "2026-02-31" }).expect(400);
      const first = entry(`${prefix}-A`);
      const created = await Promise.all([1, 2].map(() => request(app).post(treasuryPath).set(treasurer.headers).send(first)));
      assert.ok(created.every((response) => response.status === 201));
      assert.equal(created[0].body.data.id, created[1].body.data.id);
      await request(app).post(treasuryPath).set(treasurer.headers).send({ ...first, amount: "15.00" }).expect(409);
      const second = entry(`${prefix}-B`, "10.20");
      const third = { ...entry(`${prefix}-C`, "0.20"), kind: "expense" };
      for (const item of [second, third]) { await request(app).post(treasuryPath).set(treasurer.headers).send(item).expect(201); }
      let result = await request(app).get(`${treasuryPath}?search=${prefix}&limit=1`).set(treasurer.headers).expect(200);
      assert.equal(result.body.data.total, 3);
      assert.equal(result.body.data.rows.length, 1);
      assert.equal(result.body.data.totals.balance, "0.00");
      await request(app).post(`${treasuryPath}/${first.requestId}/post`).set(treasurer.headers).send({ version: 1, confirmed: false }).expect(400);
      for (const item of [first, second, third]) {
        await request(app).post(`${treasuryPath}/${item.requestId}/post`).set(treasurer.headers).send({ version: 1, confirmed: true }).expect(200);
      }
      result = await request(app).get(`${treasuryPath}?search=${prefix}&limit=1&offset=99`).set(treasurer.headers).expect(200);
      assert.deepEqual(result.body.data.rows, []);
      assert.equal(result.body.data.total, 3);
      assert.deepEqual(result.body.data.totals, { income: "20.30", expense: "0.20", balance: "20.10", currency: "RON" });
      const { requestId: _requestId, ...fields } = first;
      await request(app).patch(`${treasuryPath}/${first.requestId}`).set(treasurer.headers).send({ ...fields, version: 2, amount: "12.00" }).expect(409);
      const cancel = await Promise.all([1, 2].map(() => request(app).post(`${treasuryPath}/${first.requestId}/void`).set(treasurer.headers).send({ version: 2, reason: "Document justificativ înregistrat greșit" })));
      assert.deepEqual(cancel.map((response) => response.status).sort(), [200, 409]);
      result = await request(app).get(`${treasuryPath}?search=${prefix}`).set(treasurer.headers).expect(200);
      assert.equal(result.body.data.totals.balance, "10.00");
      assert.ok(result.body.data.rows.every((row: Record<string, unknown>) => !('requestHash' in row)));
      const history = await request(app).get(`${treasuryPath}/${first.requestId}/history`).set(treasurer.headers).expect(200);
      assert.deepEqual(history.body.data.map((row: { action: string }) => row.action).sort(), ["treasury.create", "treasury.post", "treasury.void"]);
      assert.ok(history.body.data.every((row: { actorName: string }) => row.actorName === "Responsabil treasury"));
      const audit = await query("SELECT actor_user_id::text FROM admin_audit_log WHERE target_type = 'treasury_entry' AND target_id = $1", [first.requestId]);
      assert.ok(audit.rows.every((row) => row.actor_user_id === treasurer.id));
      const publicCopy = await query("SELECT id FROM financial_transparency_records WHERE source = $1", [first.description]);
      assert.equal(publicCopy.rowCount, 0);
      await request(app).get(`${treasuryPath}/${first.requestId}/history`).set(parliamentarian.headers).expect(403);
    } finally {
      await query("DELETE FROM treasury_entries WHERE description LIKE $1", [`${prefix}%`]);
      for (const email of emails) { await deleteUserByEmail(email); }
      await fastify?.close();
    }
  });
}

test("parliamentary work requires authorized named assignees, preserves concurrent changes and closes completed work", async () => {
  const app = createApp(); const emails: string[] = []; const prefix = `PARL-${randomUUID()}`;
  try {
    const owner = await officer(app, "parliamentary", emails);
    const wrongProfile = await officer(app, "treasury", emails);
    const item = { requestId: randomUUID(), title: prefix, kind: "bill", chamber: "deputies", reference: "PL-X test 2026", sourceUrl: "https://example.test/initiative", description: "Descrierea inițiativei interne de test.", assignedTo: owner.id, dueOn: "2025-01-01" };
    await request(app).post(parliamentaryPath).set(wrongProfile.headers).send(item).expect(403);
    await request(app).post(parliamentaryPath).set(owner.headers).send({ ...item, assignedTo: wrongProfile.id }).expect(400);
    await request(app).post(parliamentaryPath).set(owner.headers).send({ ...item, sourceUrl: "javascript:alert(1)" }).expect(400);
    await request(app).post(parliamentaryPath).set(owner.headers).send(item).expect(201);
    await request(app).post(parliamentaryPath).set(owner.headers).send(item).expect(201);
    const assignees = await request(app).get("/api/admin/parliamentary/assignees").set(owner.headers).expect(200);
    assert.ok(assignees.body.data.some((row: { id: string }) => row.id === owner.id));
    assert.ok(!assignees.body.data.some((row: { id: string }) => row.id === wrongProfile.id));
    const listing = await request(app).get(`${parliamentaryPath}?search=${prefix}&pending=true`).set(owner.headers).expect(200);
    assert.equal(listing.body.data.total, 1);
    assert.equal(listing.body.data.rows[0].assignedToName, "Responsabil parliamentary");
    const { requestId: _requestId, ...fields } = item;
    const edits = await Promise.all(["Versiunea A", "Versiunea B"].map((description) => request(app).patch(`${parliamentaryPath}/${item.requestId}`).set(owner.headers).send({ ...fields, version: 1, description })));
    assert.deepEqual(edits.map((response) => response.status).sort(), [200, 409]);
    await request(app).post(`${parliamentaryPath}/${item.requestId}/status`).set(owner.headers).send({ version: 2, status: "adopted", reason: "Încercare de salt între etape" }).expect(409);
    let version = 2;
    for (const status of ["submitted", "committee", "scheduled", "adopted"]) {
      await request(app).post(`${parliamentaryPath}/${item.requestId}/status`).set(owner.headers).send({ version: version++, status, reason: `Etapa ${status} verificată pe documentul oficial` }).expect(200);
    }
    await request(app).patch(`${parliamentaryPath}/${item.requestId}`).set(owner.headers).send({ ...fields, version, description: "Modificare după închidere" }).expect(409);
    const pending = await request(app).get(`${parliamentaryPath}?search=${prefix}&pending=true`).set(owner.headers).expect(200);
    assert.equal(pending.body.data.total, 0);
    const history = await request(app).get(`${parliamentaryPath}/${item.requestId}/history`).set(owner.headers).expect(200);
    assert.equal(history.body.data.length, 6);
    assert.ok(history.body.data.every((row: { actorName: string }) => row.actorName === "Responsabil parliamentary"));
  } finally {
    await query("DELETE FROM parliamentary_items WHERE title = $1", [prefix]);
    for (const email of emails) { await deleteUserByEmail(email); }
  }
});

test("specialized duty profiles require a national mandate and never inherit from political leadership", async () => {
  const app = createApp(); const emails: string[] = [];
  try {
    for (const profile of ["treasury", "parliamentary"] as const) {
      const unassigned = await officer(app, profile, emails, "CONSILIER");
      await request(app).get(profile === "treasury" ? treasuryPath : parliamentaryPath).set(unassigned.headers).expect(403);
    }
    const email = buildTestEmail("leadership"); emails.push(email);
    await request(app).post("/api/auth/signup").send({ email, password, fullName: "Președinte fără desemnare" }).expect(201);
    await query("UPDATE users SET role = 'PRESEDINTE' WHERE email = $1", [email]);
    const signin = await request(app).post("/api/auth/signin").send(await signinTestInput({ email, password })).expect(200);
    const targetId = randomUUID();
    await query(`INSERT INTO admin_audit_log (actor_user_id, actor_email, actor_role, action, target_type, target_id, details)
      SELECT id, email, role, 'treasury.create', 'treasury_entry', $2, '{"description":"Confidențial trezorerie"}'::jsonb FROM users WHERE email = $1`, [email, targetId]);
    const audit = await request(app).get(`/api/admin/audit?targetType=treasury_entry&targetId=${targetId}`).set("Authorization", `Bearer ${signin.body.data.token}`).expect(200);
    assert.deepEqual(audit.body.data, []);
    for (const endpoint of [treasuryPath, parliamentaryPath]) {
      await request(app).get(endpoint).set("Authorization", `Bearer ${signin.body.data.token}`).expect(403);
    }
  } finally { for (const email of emails) { await deleteUserByEmail(email); } }
});
