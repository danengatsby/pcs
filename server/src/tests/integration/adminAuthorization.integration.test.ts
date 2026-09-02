import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query } from "../../lib/db.js";
import { deleteUserByEmail, deleteVolunteerByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();
const password = "ParolaFoarteBuna#2026";

async function createOfficer(input: {
  email: string;
  fullName: string;
  role: "CONSILIER" | "SECRETAR" | "VICEPRESEDINTE" | "PRESEDINTE";
}): Promise<{ id: string; token: string }> {
  await request(app)
    .post("/api/auth/signup")
    .send({ fullName: input.fullName, email: input.email, password })
    .expect(201);
  await query("UPDATE users SET role = $2 WHERE LOWER(email) = LOWER($1)", [input.email, input.role]);
  const response = await request(app)
    .post("/api/auth/signin")
    .send({ email: input.email, password })
    .expect(200);
  return {
    id: response.body?.data?.user?.id as string,
    token: response.body?.data?.token as string,
  };
}

async function createApplication(input: {
  email: string;
  county: "Cluj" | "Iași";
  locality: string;
}): Promise<number> {
  await request(app)
    .post("/api/volunteers")
    .send({
      fullName: `Dosar ${input.county}`,
      email: input.email,
      password,
      phone: "0712345678",
      county: input.county,
      locality: input.locality,
      skills: "organizare",
      motivation: "Dosar pentru verificarea izolării administrative teritoriale.",
      website: "",
    })
    .expect(201);
  const result = await query<{ id: number }>(
    "SELECT id FROM volunteers WHERE LOWER(email) = LOWER($1)",
    [input.email]
  );
  assert.ok(result.rows[0]?.id);
  return Number(result.rows[0]?.id);
}

function authorization(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

test("administrative access should enforce function permissions and active territorial mandates", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const emails = {
    president: `access.${suffix}.president@example.test`,
    vice: `access.${suffix}.vice@example.test`,
    secretary: `access.${suffix}.secretary@example.test`,
    adviser: `access.${suffix}.adviser@example.test`,
    unassignedSecretary: `access.${suffix}.unassigned@example.test`,
    clujApplicant: `access.${suffix}.cluj@example.test`,
    iasiApplicant: `access.${suffix}.iasi@example.test`,
  };
  const organizations = {
    national: `access-${suffix}-national`,
    cluj: `access-${suffix}-cluj`,
    iasi: `access-${suffix}-iasi`,
  };

  try {
    const president = await createOfficer({
      email: emails.president,
      fullName: "Președinte Acces",
      role: "PRESEDINTE",
    });
    const vice = await createOfficer({
      email: emails.vice,
      fullName: "Vicepreședinte Iași",
      role: "VICEPRESEDINTE",
    });
    const secretary = await createOfficer({
      email: emails.secretary,
      fullName: "Secretar Cluj",
      role: "SECRETAR",
    });
    const adviser = await createOfficer({
      email: emails.adviser,
      fullName: "Consilier Cluj",
      role: "CONSILIER",
    });
    const unassignedSecretary = await createOfficer({
      email: emails.unassignedSecretary,
      fullName: "Secretar Fără Mandat",
      role: "SECRETAR",
    });

    const counties = await query<{ id: number; name: string }>(
      "SELECT id, name FROM counties WHERE name IN ('Cluj', 'Iași')"
    );
    const clujCountyId = counties.rows.find((item) => item.name === "Cluj")?.id;
    const iasiCountyId = counties.rows.find((item) => item.name === "Iași")?.id;
    assert.ok(clujCountyId);
    assert.ok(iasiCountyId);

    await query(
      `INSERT INTO organizations (id, code, level, name, county, status, parent_id, founded_at)
       VALUES
         ($1, $2, 'national', 'Național acces', '', 'active', NULL, CURRENT_DATE),
         ($3, $4, 'county', 'Filiala Cluj acces', 'Cluj', 'active', $1, CURRENT_DATE),
         ($5, $6, 'county', 'Filiala Iași acces', 'Iași', 'active', $1, CURRENT_DATE)`,
      [
        organizations.national, `ACC-N-${suffix}`,
        organizations.cluj, `ACC-CJ-${suffix}`,
        organizations.iasi, `ACC-IS-${suffix}`,
      ]
    );
    await query(
      `INSERT INTO organization_territories (organization_id, territory_type, county_id, locality)
       VALUES
         ($1, 'national', NULL, ''),
         ($2, 'county', $3, ''),
         ($4, 'county', $5, '')`,
      [organizations.national, organizations.cluj, clujCountyId, organizations.iasi, iasiCountyId]
    );
    await query(
      `INSERT INTO organization_leadership_mandates (
         organization_id, user_id, full_name, position_title, started_at, status
       ) VALUES
         ($1, $2, 'Vicepreședinte Iași', 'Vicepreședinte teritorial', CURRENT_DATE, 'active'),
         ($3, $4, 'Secretar Cluj', 'Secretar teritorial', CURRENT_DATE, 'active'),
         ($3, $5, 'Consilier Cluj', 'Consilier teritorial', CURRENT_DATE, 'active')`,
      [organizations.iasi, vice.id, organizations.cluj, secretary.id, adviser.id]
    );

    const clujVolunteerId = await createApplication({
      email: emails.clujApplicant,
      county: "Cluj",
      locality: "Cluj-Napoca",
    });
    const iasiVolunteerId = await createApplication({
      email: emails.iasiApplicant,
      county: "Iași",
      locality: "Iași",
    });

    const accessResponse = await request(app)
      .get("/api/admin/access")
      .set(authorization(secretary.token))
      .expect(200);
    assert.equal(accessResponse.body?.data?.scope?.national, false);
    assert.deepEqual(accessResponse.body?.data?.scope?.counties, ["Cluj"]);
    assert.equal(accessResponse.body?.data?.capabilities?.includes("recruitment.manage"), true);
    assert.equal(accessResponse.body?.data?.capabilities?.includes("recruitment.delete"), false);

    const secretaryList = await request(app)
      .get(`/api/admin/volunteers?search=${encodeURIComponent(`access.${suffix}`)}`)
      .set(authorization(secretary.token))
      .expect(200);
    assert.deepEqual(
      secretaryList.body?.data?.map((item: { email: string }) => item.email),
      [emails.clujApplicant]
    );

    const secretaryMembers = await request(app)
      .get(`/api/admin/members/dashboard?search=${encodeURIComponent(`access.${suffix}`)}`)
      .set(authorization(secretary.token))
      .expect(200);
    assert.equal(secretaryMembers.body?.data?.rows?.length, 1);
    assert.equal(secretaryMembers.body?.data?.rows?.[0]?.email, emails.clujApplicant);
    assert.equal(secretaryMembers.body?.data?.access?.scope, "Cluj");

    const secretaryOrganizations = await request(app)
      .get("/api/admin/organizations?limit=20")
      .set(authorization(secretary.token))
      .expect(200);
    assert.deepEqual(
      secretaryOrganizations.body?.data?.rows?.map((item: { id: string }) => item.id),
      [organizations.cluj]
    );

    await request(app)
      .patch(`/api/admin/volunteers/${clujVolunteerId}/workflow`)
      .set(authorization(secretary.token))
      .send({ status: "contactat", internalNotes: "Contactat în mandatul Cluj." })
      .expect(200);
    await request(app)
      .patch(`/api/admin/volunteers/${iasiVolunteerId}/workflow`)
      .set(authorization(secretary.token))
      .send({ status: "contactat", internalNotes: "Tentativă în afara mandatului." })
      .expect(404);
    await request(app)
      .patch(`/api/admin/volunteers/${clujVolunteerId}/workflow`)
      .set(authorization(secretary.token))
      .send({
        status: "contactat",
        internalNotes: "Tentativă de mutare geografică.",
        county: "Iași",
        locality: "Iași",
      })
      .expect(403);
    await request(app)
      .patch(`/api/admin/volunteers/${clujVolunteerId}/workflow`)
      .set(authorization(secretary.token))
      .send({ status: "activ", internalNotes: "Promovare nepermisă secretarului." })
      .expect(403);
    await request(app)
      .delete(`/api/admin/volunteers/${clujVolunteerId}`)
      .set(authorization(secretary.token))
      .expect(403);

    const bulkOutsideScope = await request(app)
      .patch("/api/admin/volunteers/workflow/bulk")
      .set(authorization(secretary.token))
      .send({
        target: { type: "ids", volunteerIds: [clujVolunteerId, iasiVolunteerId] },
        status: "validat",
      })
      .expect(403);
    assert.equal(bulkOutsideScope.body?.error?.code, "ADMIN_TERRITORY_FORBIDDEN");

    await request(app)
      .patch(`/api/admin/volunteers/${clujVolunteerId}/workflow`)
      .set(authorization(adviser.token))
      .send({ status: "validat", internalNotes: "Consilierul nu modifică." })
      .expect(403);
    await request(app)
      .get("/api/admin/volunteers/export.csv")
      .set(authorization(adviser.token))
      .expect(403);
    await request(app)
      .get("/api/admin/audit")
      .set(authorization(adviser.token))
      .expect(403);

    const missingMandate = await request(app)
      .get("/api/admin/volunteers")
      .set(authorization(unassignedSecretary.token))
      .expect(403);
    assert.equal(missingMandate.body?.error?.code, "ADMIN_TERRITORY_REQUIRED");

    await request(app)
      .patch(`/api/admin/organizations/${organizations.cluj}`)
      .set(authorization(vice.token))
      .send({ officialEmail: "cluj-restricted@example.test" })
      .expect(403);
    await request(app)
      .patch(`/api/admin/organizations/${organizations.iasi}`)
      .set(authorization(vice.token))
      .send({ officialEmail: "iasi-authorized@example.test" })
      .expect(200);
    await request(app)
      .patch(`/api/admin/organizations/${organizations.iasi}`)
      .set(authorization(vice.token))
      .send({ status: "inactive" })
      .expect(403);

    const territorialDashboard = await request(app)
      .get("/api/admin/executive-dashboard")
      .set(authorization(vice.token))
      .expect(200);
    assert.equal(territorialDashboard.body?.data?.access?.scope, "Iași");
    assert.equal(territorialDashboard.body?.data?.summary?.applicationsTotal, 1);
    assert.equal(territorialDashboard.body?.data?.counties?.[0]?.county, "Iași");

    const globalContent = await request(app)
      .post("/api/news")
      .set(authorization(vice.token))
      .send({})
      .expect(403);
    assert.equal(globalContent.body?.error?.code, "ADMIN_NATIONAL_SCOPE_REQUIRED");

    const presidentList = await request(app)
      .get(`/api/admin/volunteers?search=${encodeURIComponent(`access.${suffix}`)}`)
      .set(authorization(president.token))
      .expect(200);
    assert.equal(presidentList.body?.data?.length, 2);
    await request(app)
      .get("/api/admin/audit?limit=10")
      .set(authorization(president.token))
      .expect(200);
  } finally {
    await deleteVolunteerByEmail(emails.clujApplicant);
    await deleteVolunteerByEmail(emails.iasiApplicant);
    for (const email of Object.values(emails)) {
      await deleteUserByEmail(email);
    }
    await query("DELETE FROM organizations WHERE id IN ($1, $2)", [organizations.cluj, organizations.iasi]);
    await query("DELETE FROM organizations WHERE id = $1", [organizations.national]);
  }
});
