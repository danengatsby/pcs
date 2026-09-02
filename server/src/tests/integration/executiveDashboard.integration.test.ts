import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query } from "../../lib/db.js";
import { deleteUserByEmail, deleteVolunteerByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();

type DashboardData = {
  summary: {
    applicationsTotal: number;
    applicationsLast30Days: number;
    contactedTotal: number;
    uncontactedCases: number;
    membersTotal: number;
    contactRate: number;
    memberConversionRate: number;
    overdueCases: number;
    activeOrganizations: number;
    countiesWithoutResponsible: number;
  };
  trends: Array<{
    month: string;
    applications: number;
    contacted: number;
    members: number;
  }>;
  counties: Array<{
    county: string;
    applications: number;
    contacted: number;
    members: number;
    organizers: number;
    overdue: number;
    hasResponsible: boolean;
  }>;
  workflow: Array<{ status: string; count: number }>;
  objectives: Array<{
    key: string;
    targetValue: number;
    currentValue: number;
    status: string;
  }>;
  countiesWithoutResponsible: string[];
  definitions: Record<string, string>;
};

async function setUserRole(email: string, role: string): Promise<void> {
  await query(
    `
      UPDATE users
      SET role = $2
      WHERE LOWER(email) = LOWER($1)
    `,
    [email, role]
  );
}

async function signin(email: string, password: string): Promise<string> {
  const response = await request(app)
    .post("/api/auth/signin")
    .send({ email, password })
    .expect(200);

  const token = response.body?.data?.token as string | undefined;
  assert.equal(typeof token, "string");
  return token ?? "";
}

async function insertVolunteer(input: {
  email: string;
  county: string;
  status: "nou" | "validat" | "contactat" | "activ";
  createdAt: Date;
}): Promise<void> {
  const volunteerResult = await query<{ id: number }>(
    `
      INSERT INTO volunteers (
        full_name,
        email,
        phone,
        county,
        county_id,
        locality,
        skills,
        motivation,
        workflow_status,
        internal_notes,
        created_at
      )
      VALUES ($1, $2, '0712345678', $3, NULL, 'Municipiu test', 'organizare', 'Test dashboard executiv.', $4, '', $5)
      RETURNING id
    `,
    [`Dosar ${input.status}`, input.email, input.county, input.status, input.createdAt]
  );

  const membershipStatus = input.status === "activ"
    ? "active"
    : input.status === "nou"
      ? "application"
      : "verified";
  const membershipResult = await query<{ id: number }>(
    `
      INSERT INTO membership_records (
        volunteer_id,
        full_name,
        email,
        status,
        application_at,
        validated_at,
        joined_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $7, $5, $6, $7, $7)
      RETURNING id
    `,
    [
      volunteerResult.rows[0]?.id,
      `Dosar ${input.status}`,
      input.email,
      membershipStatus,
      membershipStatus === "application" ? null : input.createdAt,
      membershipStatus === "active" ? input.createdAt : null,
      input.createdAt,
    ]
  );

  await query(
    `
      INSERT INTO membership_events (
        membership_id,
        action,
        previous_status,
        next_status,
        reason,
        effective_at,
        created_at
      )
      VALUES ($1, 'import', NULL, $2, 'Date de test pentru tabloul executiv', $3, $3)
    `,
    [membershipResult.rows[0]?.id, membershipStatus, input.createdAt]
  );
}

function calculateRate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

test("executive dashboard should aggregate recruitment data and let leadership update targets", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const password = "ParolaFoarteBuna#2026";
  const presidentEmail = `executive.${suffix}.president@example.test`;
  const adviserEmail = `executive.${suffix}.adviser@example.test`;
  const volunteerEmails = ["new", "validated", "contacted", "active"]
    .map((kind) => `executive.${suffix}.${kind}@example.test`);
  const county = "Cluj";
  let previousContactTarget = 80;

  try {
    for (const [fullName, email] of [
      ["Președinte Test", presidentEmail],
      ["Consilier Test", adviserEmail],
    ]) {
      await request(app)
        .post("/api/auth/signup")
        .send({ fullName, email, password })
        .expect(201);
    }

    await setUserRole(presidentEmail, "PRESEDINTE");
    await setUserRole(adviserEmail, "CONSILIER");

    const presidentToken = await signin(presidentEmail, password);
    const adviserToken = await signin(adviserEmail, password);

    const baselineResponse = await request(app)
      .get("/api/admin/executive-dashboard")
      .set("Authorization", `Bearer ${presidentToken}`)
      .expect(200);
    const baseline = baselineResponse.body?.data as DashboardData;
    const previousTarget = baseline.objectives.find((item) => item.key === "contact_rate");
    assert.ok(previousTarget);
    previousContactTarget = previousTarget.targetValue;

    const now = new Date();
    await Promise.all([
      insertVolunteer({
        email: volunteerEmails[0],
        county,
        status: "nou",
        createdAt: new Date(now.getTime() - 72 * 60 * 60 * 1000),
      }),
      insertVolunteer({ email: volunteerEmails[1], county, status: "validat", createdAt: now }),
      insertVolunteer({ email: volunteerEmails[2], county, status: "contactat", createdAt: now }),
      insertVolunteer({ email: volunteerEmails[3], county, status: "activ", createdAt: now }),
    ]);

    const dashboardResponse = await request(app)
      .get("/api/admin/executive-dashboard")
      .set("Authorization", `Bearer ${presidentToken}`)
      .expect(200);
    const dashboard = dashboardResponse.body?.data as DashboardData;

    assert.equal(dashboard.summary.applicationsTotal, baseline.summary.applicationsTotal + 4);
    assert.equal(dashboard.summary.applicationsLast30Days, baseline.summary.applicationsLast30Days + 4);
    assert.equal(dashboard.summary.contactedTotal, baseline.summary.contactedTotal + 2);
    assert.equal(dashboard.summary.uncontactedCases, baseline.summary.uncontactedCases + 2);
    assert.equal(dashboard.summary.membersTotal, baseline.summary.membersTotal + 1);
    assert.equal(dashboard.summary.overdueCases, baseline.summary.overdueCases + 1);
    assert.equal(dashboard.summary.activeOrganizations, baseline.summary.activeOrganizations);
    assert.equal(
      dashboard.summary.contactRate,
      calculateRate(dashboard.summary.contactedTotal, dashboard.summary.applicationsTotal)
    );
    assert.equal(
      dashboard.summary.memberConversionRate,
      calculateRate(dashboard.summary.membersTotal, dashboard.summary.applicationsTotal)
    );

    assert.equal(dashboard.trends.length, 6);
    assert.equal(
      dashboard.trends.reduce((sum, item) => sum + item.applications, 0),
      baseline.trends.reduce((sum, item) => sum + item.applications, 0) + 4
    );
    const countyRow = dashboard.counties.find((item) => item.county === county);
    assert.equal(countyRow?.county, county);
    assert.equal(countyRow?.applications, 4);
    assert.equal(countyRow?.contacted, 2);
    assert.equal(countyRow?.members, 1);
    assert.equal(countyRow?.organizers, 0);
    assert.equal(countyRow?.overdue, 1);
    assert.equal(typeof countyRow?.hasResponsible, "boolean");
    assert.deepEqual(
      dashboard.workflow.map((item) => item.status),
      ["nou", "validat", "contactat", "activ"]
    );
    assert.equal(Object.keys(dashboard.definitions).length, 7);
    assert.equal(dashboard.countiesWithoutResponsible.length, dashboard.summary.countiesWithoutResponsible);

    await request(app)
      .get("/api/admin/executive-dashboard")
      .set("Authorization", `Bearer ${adviserToken}`)
      .expect(403);

    const targetResponse = await request(app)
      .patch("/api/admin/executive-dashboard/targets/contact_rate")
      .set("Authorization", `Bearer ${presidentToken}`)
      .send({ targetValue: 77 })
      .expect(200);
    assert.equal(targetResponse.body?.data?.target?.targetValue, 77);

    const auditResult = await query<{
      actor_email: string;
      details: { previousTargetValue: number; nextTargetValue: number };
    }>(
      `
        SELECT actor_email, details
        FROM admin_audit_log
        WHERE action = 'executive_target.update'
          AND target_id = 'contact_rate'
          AND LOWER(actor_email) = LOWER($1)
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [presidentEmail]
    );
    assert.equal(auditResult.rows[0]?.actor_email, presidentEmail);
    assert.deepEqual(auditResult.rows[0]?.details, {
      previousTargetValue: previousContactTarget,
      nextTargetValue: 77,
    });

    await request(app)
      .patch("/api/admin/executive-dashboard/targets/contact_rate")
      .set("Authorization", `Bearer ${adviserToken}`)
      .send({ targetValue: 76 })
      .expect(403);

    const refreshedResponse = await request(app)
      .get("/api/admin/executive-dashboard")
      .set("Authorization", `Bearer ${presidentToken}`)
      .expect(200);
    const refreshed = refreshedResponse.body?.data as DashboardData;
    assert.equal(
      refreshed.objectives.find((item) => item.key === "contact_rate")?.targetValue,
      77
    );
  } finally {
    await query(
      `
        UPDATE executive_targets
        SET target_value = $1, updated_by = NULL, updated_at = NOW()
        WHERE key = 'contact_rate'
      `,
      [previousContactTarget]
    );
    for (const email of volunteerEmails) {
      await deleteVolunteerByEmail(email);
    }
    await deleteUserByEmail(adviserEmail);
    await deleteUserByEmail(presidentEmail);
  }
});

test("executive dashboard should require authentication", async () => {
  const response = await request(app)
    .get("/api/admin/executive-dashboard")
    .expect(401);

  assert.equal(response.body?.error?.code, "AUTH_UNAUTHORIZED");
});
