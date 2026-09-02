import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query } from "../../lib/db.js";
import { deleteUserByEmail, deleteVolunteerByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();
const password = "ParolaFoarteBuna#2026";

async function createUser(email: string, fullName: string, role: string): Promise<string> {
  await request(app).post("/api/auth/signup").send({ fullName, email, password }).expect(201);
  await query("UPDATE users SET role = $2 WHERE LOWER(email) = LOWER($1)", [email, role]);
  const signin = await request(app).post("/api/auth/signin").send({ email, password }).expect(200);
  const token = signin.body?.data?.token as string | undefined;
  assert.ok(token);
  return token;
}

async function createApplication(email: string, fullName: string): Promise<void> {
  await request(app)
    .post("/api/volunteers")
    .send({
      fullName,
      email,
      password,
      phone: "0712345678",
      county: "Cluj",
      locality: "Cluj-Napoca",
      skills: "organizare",
      motivation: "Doresc să particip la activitatea organizației locale.",
      website: "",
    })
    .expect(201);
}

test("membership registry should paginate and execute the complete governed lifecycle", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const presidentEmail = `membership.${suffix}.president@example.test`;
  const secretaryEmail = `membership.${suffix}.secretary@example.test`;
  const adviserEmail = `membership.${suffix}.adviser@example.test`;
  const memberEmail = `membership.${suffix}.member@example.test`;
  const secondEmail = `membership.${suffix}.second@example.test`;
  const organizationOne = `org-membership-${suffix}-one`;
  const organizationTwo = `org-membership-${suffix}-two`;

  try {
    const presidentToken = await createUser(presidentEmail, "Președinte Registru", "PRESEDINTE");
    const secretaryToken = await createUser(secretaryEmail, "Secretar Registru", "SECRETAR");
    const adviserToken = await createUser(adviserEmail, "Consilier Registru", "CONSILIER");

    await query(
      `INSERT INTO organizations (id, code, level, name, county, members_count, status, founded_at)
       VALUES
         ($1, $2, 'county', 'Filiala Test Unu', 'Cluj', 0, 'active', CURRENT_DATE),
         ($3, $4, 'county', 'Filiala Test Doi', 'Alba', 0, 'active', CURRENT_DATE)`,
      [organizationOne, `MEM-${suffix}-1`, organizationTwo, `MEM-${suffix}-2`]
    );
    await query(
      `INSERT INTO organization_territories (organization_id, territory_type, county_id, locality)
       SELECT $1, 'county', id, '' FROM counties WHERE name = 'Cluj'
       UNION ALL
       SELECT $2, 'county', id, '' FROM counties WHERE name = 'Alba'`,
      [organizationOne, organizationTwo]
    );
    await query(
      `INSERT INTO organization_leadership_mandates (
         organization_id, user_id, full_name, position_title, started_at, status
       )
       SELECT organization_id, u.id, u.full_name, 'Secretar teritorial', CURRENT_DATE, 'active'
       FROM users u
       CROSS JOIN (VALUES ($2::varchar), ($3::varchar)) AS scoped(organization_id)
       WHERE LOWER(u.email) = LOWER($1)`,
      [secretaryEmail, organizationOne, organizationTwo]
    );

    await createApplication(memberEmail, "Membru Flux Complet");
    await createApplication(secondEmail, "Membru Paginare");

    const firstPage = await request(app)
      .get(`/api/admin/members/dashboard?search=${encodeURIComponent(`membership.${suffix}`)}&limit=1&offset=0`)
      .set("Authorization", `Bearer ${presidentToken}`)
      .expect(200);
    assert.equal(firstPage.body?.data?.pagination?.total, 2);
    assert.equal(firstPage.body?.data?.rows?.length, 1);
    assert.equal(firstPage.body?.data?.pagination?.hasNext, true);

    const secondPage = await request(app)
      .get(`/api/admin/members/dashboard?search=${encodeURIComponent(`membership.${suffix}`)}&limit=1&offset=1`)
      .set("Authorization", `Bearer ${presidentToken}`)
      .expect(200);
    assert.equal(secondPage.body?.data?.pagination?.hasPrevious, true);

    const registry = await request(app)
      .get(`/api/admin/members/dashboard?search=${encodeURIComponent(memberEmail)}&limit=25`)
      .set("Authorization", `Bearer ${presidentToken}`)
      .expect(200);
    const application = registry.body?.data?.rows?.[0] as {
      id: string;
      membershipStatus: string;
      role: string;
      memberNumber: string | null;
      version: number;
      availableActions: string[];
    };
    assert.equal(application.membershipStatus, "application");
    assert.equal(application.role, "SUSTINATOR");
    assert.equal(application.memberNumber, null);
    assert.equal(application.version, 1);
    assert.ok(application.availableActions.includes("verify"));
    const submittedEvent = await query<{ previous_status: string; next_status: string }>(
      `SELECT previous_status, next_status
       FROM membership_events
       WHERE membership_id = $1
       ORDER BY id ASC
       LIMIT 1`,
      [application.id]
    );
    assert.equal(submittedEvent.rows[0]?.previous_status, "supporter");
    assert.equal(submittedEvent.rows[0]?.next_status, "application");

    await request(app)
      .post(`/api/admin/members/${application.id}/actions`)
      .set("Authorization", `Bearer ${adviserToken}`)
      .send({ action: "verify", expectedVersion: 1 })
      .expect(403);

    const verifiedResponse = await request(app)
      .post(`/api/admin/members/${application.id}/actions`)
      .set("Authorization", `Bearer ${secretaryToken}`)
      .send({ action: "verify", expectedVersion: 1 })
      .expect(200);
    assert.equal(verifiedResponse.body?.data?.membership?.membershipStatus, "verified");
    assert.equal(verifiedResponse.body?.data?.membership?.role, "SUSTINATOR");
    assert.equal(verifiedResponse.body?.data?.membership?.version, 2);

    await request(app)
      .post(`/api/admin/members/${application.id}/actions`)
      .set("Authorization", `Bearer ${secretaryToken}`)
      .send({ action: "approve", approvalOrganizationId: organizationOne, expectedVersion: 2 })
      .expect(403);

    const approvedResponse = await request(app)
      .post(`/api/admin/members/${application.id}/actions`)
      .set("Authorization", `Bearer ${presidentToken}`)
      .send({ action: "approve", approvalOrganizationId: organizationOne, expectedVersion: 2 })
      .expect(200);
    assert.equal(approvedResponse.body?.data?.membership?.membershipStatus, "approved");
    assert.equal(approvedResponse.body?.data?.membership?.role, "ADERENT");
    assert.equal(approvedResponse.body?.data?.membership?.approvalOrganization?.id, organizationOne);
    assert.equal(approvedResponse.body?.data?.membership?.memberNumber, null);

    const activatedResponse = await request(app)
      .post(`/api/admin/members/${application.id}/actions`)
      .set("Authorization", `Bearer ${presidentToken}`)
      .send({ action: "activate", expectedVersion: 3 })
      .expect(200);
    assert.equal(activatedResponse.body?.data?.membership?.membershipStatus, "active");
    assert.equal(activatedResponse.body?.data?.membership?.role, "MEMBRU");
    assert.match(activatedResponse.body?.data?.membership?.memberNumber as string, /^PCS-\d{4}-\d{6}$/);

    const transferredResponse = await request(app)
      .post(`/api/admin/members/${application.id}/actions`)
      .set("Authorization", `Bearer ${secretaryToken}`)
      .send({
        action: "transfer",
        organizationId: organizationTwo,
        reason: "Repartizare conform domiciliului",
        expectedVersion: 4,
      })
      .expect(200);
    assert.equal(transferredResponse.body?.data?.membership?.organization?.id, organizationTwo);

    const suspendedResponse = await request(app)
      .post(`/api/admin/members/${application.id}/actions`)
      .set("Authorization", `Bearer ${presidentToken}`)
      .send({ action: "suspend", reason: "Suspendare aprobată de conducere", expectedVersion: 5 })
      .expect(200);
    assert.equal(suspendedResponse.body?.data?.membership?.membershipStatus, "suspended");
    assert.equal(suspendedResponse.body?.data?.membership?.role, "SUSTINATOR");

    const conflict = await request(app)
      .post(`/api/admin/members/${application.id}/actions`)
      .set("Authorization", `Bearer ${presidentToken}`)
      .send({ action: "reactivate", expectedVersion: 5 })
      .expect(409);
    assert.equal(conflict.body?.error?.code, "MEMBERSHIP_VERSION_CONFLICT");

    const reactivatedResponse = await request(app)
      .post(`/api/admin/members/${application.id}/actions`)
      .set("Authorization", `Bearer ${presidentToken}`)
      .send({ action: "reactivate", expectedVersion: 6 })
      .expect(200);
    assert.equal(reactivatedResponse.body?.data?.membership?.membershipStatus, "active");
    assert.equal(reactivatedResponse.body?.data?.membership?.role, "MEMBRU");

    const secondTransfer = await request(app)
      .post(`/api/admin/members/${application.id}/actions`)
      .set("Authorization", `Bearer ${secretaryToken}`)
      .send({ action: "transfer", organizationId: organizationOne, expectedVersion: 7 })
      .expect(200);
    assert.equal(secondTransfer.body?.data?.membership?.organization?.id, organizationOne);

    const terminatedResponse = await request(app)
      .post(`/api/admin/members/${application.id}/actions`)
      .set("Authorization", `Bearer ${presidentToken}`)
      .send({ action: "terminate", reason: "Cerere scrisă de retragere", expectedVersion: 8 })
      .expect(200);
    assert.equal(terminatedResponse.body?.data?.membership?.membershipStatus, "terminated");
    assert.equal(terminatedResponse.body?.data?.membership?.role, "SUSTINATOR");
    assert.equal(terminatedResponse.body?.data?.membership?.availableActions?.length, 0);
    assert.ok(terminatedResponse.body?.data?.membership?.history?.length > 0);

    const persisted = await query<{
      status: string;
      role: string;
      workflow_status: string;
      organization_id: string;
      approval_organization_id: string;
      member_number: string;
      event_count: string;
      audit_count: string;
    }>(
      `SELECT
         mr.status,
         u.role,
         v.workflow_status,
         mr.organization_id,
         mr.approval_organization_id,
         mr.member_number,
         (SELECT COUNT(*)::text FROM membership_events me WHERE me.membership_id = mr.id) AS event_count,
         (SELECT COUNT(*)::text FROM admin_audit_log aal WHERE aal.target_type = 'membership' AND aal.target_id = mr.id::text) AS audit_count
       FROM membership_records mr
       JOIN users u ON u.id = mr.user_id
       JOIN volunteers v ON v.id = mr.volunteer_id
       WHERE LOWER(mr.email) = LOWER($1)`,
      [memberEmail]
    );
    assert.equal(persisted.rows[0]?.status, "terminated");
    assert.equal(persisted.rows[0]?.role, "SUSTINATOR");
    assert.equal(persisted.rows[0]?.workflow_status, "activ");
    assert.equal(persisted.rows[0]?.organization_id, organizationOne);
    assert.equal(persisted.rows[0]?.approval_organization_id, organizationOne);
    assert.match(persisted.rows[0]?.member_number ?? "", /^PCS-\d{4}-\d{6}$/);
    assert.equal(Number(persisted.rows[0]?.event_count), 9);
    assert.equal(Number(persisted.rows[0]?.audit_count), 8);

    const memberSignin = await request(app)
      .post("/api/auth/signin")
      .send({ email: memberEmail, password })
      .expect(200);
    await request(app)
      .get("/api/admin/members/dashboard")
      .set("Authorization", `Bearer ${memberSignin.body?.data?.token as string}`)
      .expect(403);
  } finally {
    await deleteVolunteerByEmail(memberEmail);
    await deleteVolunteerByEmail(secondEmail);
    await deleteUserByEmail(memberEmail);
    await deleteUserByEmail(secondEmail);
    await deleteUserByEmail(adviserEmail);
    await deleteUserByEmail(secretaryEmail);
    await deleteUserByEmail(presidentEmail);
    await query("DELETE FROM organizations WHERE id IN ($1, $2)", [organizationOne, organizationTwo]);
  }
});
