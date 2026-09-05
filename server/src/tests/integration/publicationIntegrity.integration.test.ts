import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { assertNoDemoDataInProduction } from "../../lib/productionDataIntegrity.js";
import { query } from "../../lib/db.js";
import { updatePoliticalOperationFromRepository } from "../../modules/politicalOperations/politicalOperations.repository.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();

test("production integrity should fail closed while any demo row exists", async () => {
  const email = buildTestEmail("production-integrity-demo");
  try {
    await query(`
      INSERT INTO users (full_name, email, password_hash, role, is_demo)
      VALUES ('Utilizator Demo Test', $1, 'not-used', 'SUSTINATOR', TRUE)
    `, [email]);

    await assert.rejects(
      assertNoDemoDataInProduction("production"),
      /Pornire blocata: baza de productie contine date demonstrative/,
    );
  } finally {
    await deleteUserByEmail(email);
  }

  await assertNoDemoDataInProduction("production");
});

test("public stats should expose only editorially approved snapshots", async () => {
  const approverEmail = buildTestEmail("indicator-approver");
  try {
    const approverResult = await query<{ id: string }>(`
      INSERT INTO users (full_name, email, password_hash, role, is_demo)
      VALUES ('Aprobator Indicator Test', $1, 'not-used', 'PRESEDINTE', FALSE)
      RETURNING id
    `, [approverEmail]);
    const approverId = approverResult.rows[0]?.id;
    assert.ok(approverId);

    await query("DELETE FROM public_indicators WHERE key IN ('volunteers', 'news')");
    await query(`
      INSERT INTO public_indicators (
        key, value, is_demo, calculated_at, approved_at, approved_by
      )
      VALUES
        ('volunteers', 17, FALSE, NOW(), NOW(), $1),
        ('news', 4, FALSE, NOW(), NOW(), $1)
    `, [approverId]);

    const approved = await request(app).get("/api/stats").expect(200);
    assert.deepEqual(approved.body?.data, { volunteers: 10, news: 4 });

    await query(`
      UPDATE public_indicators
      SET approved_at = NULL, approved_by = NULL
      WHERE key = 'news'
    `);
    const partiallyApproved = await request(app).get("/api/stats").expect(200);
    assert.deepEqual(partiallyApproved.body?.data, { volunteers: 10, news: null });
  } finally {
    await query("DELETE FROM public_indicators WHERE key IN ('volunteers', 'news')");
    await deleteUserByEmail(approverEmail);
  }
});

test("partial action edits should revoke publication approval until status is reconfirmed", async () => {
  const suffix = randomUUID();
  const approverEmail = buildTestEmail("action-approval");
  let actionId: string | null = null;
  try {
    const approverResult = await query<{ id: string }>(`
      INSERT INTO users (full_name, email, password_hash, role, is_demo)
      VALUES ('Aprobator Actiune Test', $1, 'not-used', 'PRESEDINTE', FALSE)
      RETURNING id
    `, [approverEmail]);
    const approverId = approverResult.rows[0]?.id;
    assert.ok(approverId);

    const actionResult = await query<{ id: string }>(`
      INSERT INTO mobilization_actions (
        slug, action_type, title, summary, status, visibility, is_demo,
        public_approved_at, public_approved_by
      )
      VALUES ($1, 'campaign', 'Actiune publica test', 'Rezumat public test',
        'open', 'public', FALSE, NOW(), $2)
      RETURNING id
    `, [`publication-action-${suffix}`, approverId]);
    actionId = actionResult.rows[0]?.id ?? null;
    assert.ok(actionId);

    await updatePoliticalOperationFromRepository({
      id: BigInt(actionId),
      payload: { resultSummary: "Rezultat intermediar neverificat", expectedVersion: 1 },
      actorId: BigInt(approverId),
    });
    const revoked = await query<{ public_approved_at: Date | null; public_approved_by: string | null }>(`
      SELECT public_approved_at, public_approved_by
      FROM mobilization_actions
      WHERE id = $1
    `, [actionId]);
    assert.equal(revoked.rows[0]?.public_approved_at, null);
    assert.equal(revoked.rows[0]?.public_approved_by, null);

    await updatePoliticalOperationFromRepository({
      id: BigInt(actionId),
      payload: { status: "open", expectedVersion: 2 },
      actorId: BigInt(approverId),
    });
    const reapproved = await query<{ public_approved_at: Date | null; public_approved_by: string | null }>(`
      SELECT public_approved_at, public_approved_by
      FROM mobilization_actions
      WHERE id = $1
    `, [actionId]);
    assert.ok(reapproved.rows[0]?.public_approved_at);
    assert.equal(reapproved.rows[0]?.public_approved_by, approverId);
  } finally {
    if (actionId) {await query("DELETE FROM mobilization_actions WHERE id = $1", [actionId]);}
    await deleteUserByEmail(approverEmail);
  }
});

test("database constraints should reject editorial approval for demo content", async () => {
  const suffix = randomUUID();
  const approverEmail = buildTestEmail("demo-approval-constraint");
  try {
    const approverResult = await query<{ id: string }>(`
      INSERT INTO users (full_name, email, password_hash, role, is_demo)
      VALUES ('Aprobator Constrangere Test', $1, 'not-used', 'PRESEDINTE', FALSE)
      RETURNING id
    `, [approverEmail]);
    const approverId = approverResult.rows[0]?.id;
    assert.ok(approverId);

    await assert.rejects(
      query(`
        INSERT INTO news (
          title, summary, category, content, status, tags, is_demo,
          public_approved_at, public_approved_by
        )
        VALUES ($1, 'Sumar demo', 'Test', 'Continut demo', 'published', '[]', TRUE, NOW(), $2)
      `, [`Demo constraint ${suffix}`, approverId]),
      /chk_news_demo_not_public/,
    );
  } finally {
    await deleteUserByEmail(approverEmail);
  }
});
