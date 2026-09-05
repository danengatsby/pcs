import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query } from "../../lib/db.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();

test("mobilization routes list an open action and record one response per email", async () => {
  const slug = `test-consultation-${randomUUID()}`;
  const email = buildTestEmail("mobilization");
  const approverEmail = buildTestEmail("mobilization-approver");

  try {
    const approverResult = await query<{ id: string }>(`
      INSERT INTO users (full_name, email, password_hash, role, is_demo)
      VALUES ('Aprobator Mobilizare Test', $1, 'not-used', 'PRESEDINTE', FALSE)
      RETURNING id
    `, [approverEmail]);
    const approverId = approverResult.rows[0]?.id;
    assert.ok(approverId);
    await query(`
      INSERT INTO mobilization_actions (
        slug, action_type, title, summary, description, scope, participation_mode, commitment,
        sort_order, is_demo, public_approved_at, public_approved_by
      )
      VALUES (
        $1, 'consultation', 'Consultare test', 'Rezumat test', 'Descriere test', 'online',
        'Online', 'Confirmare test', 999, FALSE, NOW(), $2
      )
    `, [slug, approverId]);

    const listResponse = await request(app).get("/api/mobilization/actions").expect(200);
    const listed = listResponse.body?.data as Array<{ slug: string; type: string }> | undefined;
    assert.ok(listed?.some((action) => action.slug === slug && action.type === "consultation"));

    const payload = {
      fullName: "Participant Test",
      email,
      county: "Cluj",
      interests: ["pensii"],
      updatesConsent: true,
      privacyConsent: true,
    };

    const created = await request(app)
      .post(`/api/mobilization/actions/${slug}/responses`)
      .send(payload)
      .expect(201);
    assert.equal(created.body?.data?.accepted, true);
    assert.equal(typeof created.body?.data?.id, "string");

    const duplicate = await request(app)
      .post(`/api/mobilization/actions/${slug}/responses`)
      .send(payload)
      .expect(409);
    assert.equal(duplicate.body?.error?.code, "MOBILIZATION_RESPONSE_EXISTS");
  } finally {
    await query("DELETE FROM mobilization_actions WHERE slug = $1", [slug]);
    await deleteUserByEmail(approverEmail);
  }
});
