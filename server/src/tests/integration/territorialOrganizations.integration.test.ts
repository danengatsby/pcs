import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query } from "../../lib/db.js";
import { deleteUserByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();

async function signupWithRole(input: {
  fullName: string;
  email: string;
  password: string;
  role: string;
}): Promise<{ token: string; userId: string }> {
  await request(app)
    .post("/api/auth/signup")
    .send({ fullName: input.fullName, email: input.email, password: input.password })
    .expect(201);
  await query("UPDATE users SET role = $2 WHERE LOWER(email) = LOWER($1)", [input.email, input.role]);
  const response = await request(app)
    .post("/api/auth/signin")
    .send({ email: input.email, password: input.password })
    .expect(200);
  const token = response.body?.data?.token as string | undefined;
  const userId = response.body?.data?.user?.id as string | undefined;
  assert.equal(typeof token, "string");
  assert.equal(typeof userId, "string");
  return { token: token ?? "", userId: userId ?? "" };
}

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

test("territorial registry should persist hierarchy, territories, mandates and objectives", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  const password = "ParolaFoarteBuna#2026";
  const presidentEmail = `territorial.${suffix}.president@example.test`;
  const adviserEmail = `territorial.${suffix}.adviser@example.test`;
  const organizationIds: string[] = [];

  try {
    await query("DELETE FROM organizations WHERE level = 'national' AND status IN ('active', 'forming')");
    const president = await signupWithRole({
      fullName: "Președinte Registru Test",
      email: presidentEmail,
      password,
      role: "PRESEDINTE",
    });
    const adviser = await signupWithRole({
      fullName: "Consilier Registru Test",
      email: adviserEmail,
      password,
      role: "CONSILIER",
    });
    const countyRows = await query<{ id: number; name: string }>(
      "SELECT id, name FROM counties WHERE name IN ('Cluj', 'Iași') ORDER BY name"
    );
    const cluj = countyRows.rows.find((county) => county.name === "Cluj");
    const iasi = countyRows.rows.find((county) => county.name === "Iași");
    assert.ok(cluj);
    assert.ok(iasi);

    const emptyRegistry = await request(app)
      .get("/api/admin/organizations?limit=200")
      .set(auth(president.token))
      .expect(200);
    assert.equal(emptyRegistry.body?.data?.rows?.some((row: { id: string }) => row.id === "org-national-pcs"), false);

    const nationalResponse = await request(app)
      .post("/api/admin/organizations")
      .set(auth(president.token))
      .send({
        code: `NAT-${suffix}`,
        name: `Organizația Națională ${suffix}`,
        level: "national",
        status: "active",
        parentId: null,
        membersCount: 30,
        officialEmail: `national.${suffix.toLowerCase()}@example.test`,
        phone: "0210000000",
        headquarters: "Sediu național test",
        foundedAt: "2026-01-15",
        territories: [{ type: "national" }],
      })
      .expect(201);
    const nationalId = nationalResponse.body?.data?.id as string;
    organizationIds.push(nationalId);
    assert.equal(nationalResponse.body?.data?.foundedAt, "2026-01-15");
    assert.deepEqual(nationalResponse.body?.data?.territories?.map((row: { label: string }) => row.label), ["România"]);

    await request(app)
      .post("/api/admin/organizations")
      .set(auth(president.token))
      .send({
        code: `NAT-SECOND-${suffix}`,
        name: "Altă organizație națională",
        level: "national",
        status: "active",
        territories: [{ type: "national" }],
      })
      .expect(409);

    const countyResponse = await request(app)
      .post("/api/admin/organizations")
      .set(auth(president.token))
      .send({
        code: `CJ-${suffix}`,
        name: `Filiala Județeană Cluj ${suffix}`,
        level: "county",
        status: "active",
        parentId: nationalId,
        membersCount: 12,
        foundedAt: "2026-02-01",
        territories: [{ type: "county", countyId: cluj.id }],
      })
      .expect(201);
    const countyId = countyResponse.body?.data?.id as string;
    organizationIds.push(countyId);
    assert.equal(countyResponse.body?.data?.parent?.id, nationalId);
    assert.equal(countyResponse.body?.data?.county, "Cluj");

    const invalidLocal = await request(app)
      .post("/api/admin/organizations")
      .set(auth(president.token))
      .send({
        code: `LOC-WRONG-${suffix}`,
        name: "Organizație locală în județ greșit",
        level: "local",
        status: "forming",
        parentId: countyId,
        territories: [{ type: "locality", countyId: iasi.id, locality: "Iași" }],
      })
      .expect(400);
    assert.equal(invalidLocal.body?.error?.code, "ORGANIZATION_VALIDATION_FAILED");

    const localResponse = await request(app)
      .post("/api/admin/organizations")
      .set(auth(president.token))
      .send({
        code: `LOC-${suffix}`,
        name: `Organizația Locală Cluj-Napoca ${suffix}`,
        level: "local",
        status: "forming",
        parentId: countyId,
        membersCount: 5,
        foundedAt: "2026-03-01",
        territories: [{ type: "locality", countyId: cluj.id, locality: "Cluj-Napoca" }],
      })
      .expect(201);
    const localId = localResponse.body?.data?.id as string;
    organizationIds.push(localId);

    await request(app)
      .post(`/api/admin/organizations/${countyId}/mandates`)
      .set(auth(president.token))
      .send({
        userId: Number(president.userId),
        fullName: "Președinte Filială Test",
        positionTitle: "Președinte filială",
        startedAt: "2026-02-01",
        status: "active",
        decision: {
          decisionNumber: `DEC-${suffix}`,
          decisionDate: "2026-02-01",
          issuingBody: "Congresul organizației județene",
          minutesPath: `/test/decisions/DEC-${suffix}.pdf`,
        },
      })
      .expect(201);

    await request(app)
      .post(`/api/admin/organizations/${countyId}/mandates`)
      .set(auth(president.token))
      .send({
        userId: Number(adviser.userId),
        fullName: "Consilier Filială Test",
        positionTitle: "Consilier județean",
        startedAt: "2026-02-01",
        status: "active",
        decision: {
          decisionNumber: `DEC-CONS-${suffix}`,
          decisionDate: "2026-02-01",
          issuingBody: "Consiliul organizației județene",
          minutesPath: `/test/decisions/DEC-CONS-${suffix}.pdf`,
        },
      })
      .expect(201);

    const objectiveResponse = await request(app)
      .post(`/api/admin/organizations/${countyId}/objectives`)
      .set(auth(president.token))
      .send({
        title: "Creșterea bazei de membri",
        description: "Obiectiv măsurabil pentru trimestrul curent.",
        metricName: "membri activi",
        targetValue: 50,
        currentValue: 12,
        unit: "membri",
        dueDate: "2026-12-31",
        status: "in_progress",
      })
      .expect(201);
    const objectiveId = objectiveResponse.body?.data?.objectives?.[0]?.id as string;
    assert.equal(typeof objectiveId, "string");

    await request(app)
      .patch(`/api/admin/organizations/${countyId}/objectives/${objectiveId}`)
      .set(auth(president.token))
      .send({ currentValue: 50, status: "achieved" })
      .expect(200);

    const detailResponse = await request(app)
      .get(`/api/admin/organizations/${countyId}`)
      .set(auth(adviser.token))
      .expect(200);
    const detail = detailResponse.body?.data;
    assert.equal(detail.children.length, 1);
    assert.equal(detail.mandates.length, 2);
    assert.equal(
      detail.mandates.some((mandate: { accountEmail: string }) => mandate.accountEmail === presidentEmail.toLowerCase()),
      true
    );
    assert.equal(detail.objectives[0].currentValue, 50);
    assert.equal(detail.objectives[0].status, "achieved");

    const registryResponse = await request(app)
      .get("/api/admin/organizations?limit=200")
      .set(auth(adviser.token))
      .expect(200);
    assert.equal(registryResponse.body?.data?.summary?.organizations, 2);
    assert.equal(registryResponse.body?.data?.summary?.active, 1);
    assert.equal(registryResponse.body?.data?.summary?.forming, 1);
    assert.equal(registryResponse.body?.data?.summary?.countiesCovered, 1);
    assert.equal(registryResponse.body?.data?.summary?.activeMandates, 2);
    assert.ok(Array.isArray(registryResponse.body?.data?.counties));

    await request(app)
      .post("/api/admin/organizations")
      .set(auth(adviser.token))
      .send({
        code: `DENIED-${suffix}`,
        name: "Organizație fără permisiune",
        level: "national",
        status: "forming",
        territories: [{ type: "national" }],
      })
      .expect(403);

    const publicResponse = await request(app)
      .get(`/api/organizations?search=${suffix}&limit=20`)
      .expect(200);
    assert.equal(publicResponse.body?.data?.length, 2);
    assert.equal(publicResponse.body?.data?.some((row: { id: string }) => row.id === localId), false);
    assert.equal(publicResponse.body?.data?.every((row: { foundedAt: string | null }) => row.foundedAt !== "1970-01-01"), true);
    const publicNational = publicResponse.body?.data?.find((row: { id: string }) => row.id === nationalId);
    assert.equal(publicNational?.officialEmail, `national.${suffix.toLowerCase()}@example.test`);
    assert.equal(publicNational?.phone, "0210000000");
    assert.equal(publicNational?.headquarters, "Sediu național test");
    const publicCounty = publicResponse.body?.data?.find((row: { id: string }) => row.id === countyId);
    assert.deepEqual(publicCounty?.leaders, [
      { fullName: "Președinte Filială Test", positionTitle: "Președinte filială" },
      { fullName: "Consilier Filială Test", positionTitle: "Consilier județean" },
    ]);

    await query(`
      UPDATE organization_leadership_mandates
      SET public_approved_at = NULL, public_approved_by = NULL
      WHERE organization_id = $1 AND full_name = 'Consilier Filială Test'
    `, [countyId]);
    const leadersAfterApprovalRevoked = await request(app)
      .get(`/api/organizations?search=${suffix}&limit=20`)
      .expect(200);
    const reviewedCounty = leadersAfterApprovalRevoked.body?.data?.find(
      (row: { id: string }) => row.id === countyId,
    );
    assert.deepEqual(reviewedCounty?.leaders, [
      { fullName: "Președinte Filială Test", positionTitle: "Președinte filială" },
    ]);

    await query(`
      UPDATE organizations
      SET public_approved_at = NULL, public_approved_by = NULL
      WHERE id = $1
    `, [countyId]);
    const organizationsAfterApprovalRevoked = await request(app)
      .get(`/api/organizations?search=${suffix}&limit=20`)
      .expect(200);
    assert.equal(
      organizationsAfterApprovalRevoked.body?.data?.some((row: { id: string }) => row.id === countyId),
      false,
    );

    const auditRows = await query<{ action: string }>(
      `
        SELECT action
        FROM admin_audit_log
        WHERE target_type = 'organization'
          AND target_id = $1
        ORDER BY id ASC
      `,
      [countyId]
    );
    assert.deepEqual(auditRows.rows.map((row) => row.action), [
      "organization.create",
      "organization.mandate.create",
      "organization.mandate.create",
      "organization.objective.create",
      "organization.objective.update",
    ]);
  } finally {
    await query("DELETE FROM organization_leadership_mandates WHERE organization_id = ANY($1::varchar[])", [organizationIds]);
    await query("DELETE FROM organization_mandate_decisions WHERE organization_id = ANY($1::varchar[])", [organizationIds]);
    for (const id of organizationIds.reverse()) {
      await query("DELETE FROM organizations WHERE id = $1", [id]);
    }
    await deleteUserByEmail(adviserEmail);
    await deleteUserByEmail(presidentEmail);
  }
});
