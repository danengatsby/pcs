import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { seedAdminDemoData } from "../../lib/adminDemoData.js";
import { query } from "../../lib/db.js";
import { env } from "../../lib/env.js";
import { assertNoDemoDataInProduction } from "../../lib/productionDataIntegrity.js";
import { updateOrganizationMandateRepository, updateOrganizationRepository } from "../../modules/organizations/organizations.repository.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";

test("admin demo data is explicit, repeatable, assigned to organizers and excluded from public data", async () => {
  const originalMode = env.adminDemoDataAllowed;
  const email = buildTestEmail("existing-admin-demo-test");
  const app = createApp();
  try {
    env.adminDemoDataAllowed = false;
    await assert.rejects(seedAdminDemoData(), /ADMIN_DEMO_DATA_ALLOWED/);
    const actor = await query<{ id: string }>("INSERT INTO users (full_name, email, password_hash, role) VALUES ('Existing Account', $1, 'unused', 'PRESEDINTE') RETURNING id::text", [email]);
    const actorId = BigInt(actor.rows[0].id);
    const statsBefore = (await request(app).get("/api/stats").expect(200)).body.data;
    const publicBefore = (await request(app).get("/api/organizations").expect(200)).body.data;
    env.adminDemoDataAllowed = true;
    assert.deepEqual(await seedAdminDemoData(), { members: 60, volunteers: 24, organizations: 7, organizers: 7 });
    assert.deepEqual(await seedAdminDemoData(), { members: 60, volunteers: 24, organizations: 7, organizers: 7 });
    const unchanged = await query("SELECT full_name, role, is_demo FROM users WHERE email = $1", [email]);
    assert.deepEqual(unchanged.rows[0], { full_name: "Existing Account", role: "PRESEDINTE", is_demo: false });

    const unassigned = await query(`SELECT id FROM volunteers WHERE email LIKE '%@admin-demo.example.test' AND (owner_user_id IS NULL OR phone <> '')`);
    assert.equal(unassigned.rowCount, 0);
    const broken = await query(`SELECT organization.id FROM organizations organization WHERE organization.id LIKE 'admin-demo-%'
      AND NOT EXISTS (SELECT 1 FROM organization_leadership_mandates mandate WHERE mandate.organization_id = organization.id AND mandate.status = 'active' AND mandate.is_demo = TRUE)`);
    assert.equal(broken.rowCount, 0);
    await assert.rejects(assertNoDemoDataInProduction("production"), /Pornire blocata/);

    await updateOrganizationRepository("admin-demo-county-cluj", { name: "Cluj editat (Demo)", status: "active", actorId });
    const mandate = await query<{ id: string }>("SELECT id::text FROM organization_leadership_mandates WHERE organization_id = 'admin-demo-county-cluj'");
    await updateOrganizationMandateRepository("admin-demo-county-cluj", Number(mandate.rows[0].id), { status: "active", actorId });
    const stillDemo = await query("SELECT is_demo, public_approved_at FROM organizations WHERE id = 'admin-demo-county-cluj'");
    assert.deepEqual(stillDemo.rows[0], { is_demo: true, public_approved_at: null });
    await seedAdminDemoData();
    const retained = await query("SELECT name FROM organizations WHERE id = 'admin-demo-county-cluj'");
    assert.equal(retained.rows[0].name, "Cluj editat (Demo)");
    assert.deepEqual((await request(app).get("/api/stats").expect(200)).body.data, statsBefore);
    assert.deepEqual((await request(app).get("/api/organizations").expect(200)).body.data, publicBefore);

    const news = await query<{ id: number }>("INSERT INTO news (title, summary, is_demo) VALUES ('Unrelated demo', 'Not allowed in admin mode', TRUE) RETURNING id");
    try {
      await assert.rejects(assertNoDemoDataInProduction("production"), /Pornire blocata/);
    } finally {
      await query("DELETE FROM news WHERE id = $1", [news.rows[0].id]);
    }
  } finally {
    env.adminDemoDataAllowed = originalMode;
    await query("DELETE FROM organization_leadership_mandates WHERE organization_id LIKE 'admin-demo-%'");
    await query("DELETE FROM membership_records WHERE email LIKE '%@admin-demo.example.test'");
    await query("DELETE FROM volunteers WHERE email LIKE '%@admin-demo.example.test'");
    await query("DELETE FROM users WHERE email LIKE '%@admin-demo.example.test'");
    for (const level of ["local", "county", "national"]) {
      await query("DELETE FROM organizations WHERE id LIKE 'admin-demo-%' AND level = $1", [level]);
    }
    await deleteUserByEmail(email);
  }
});
