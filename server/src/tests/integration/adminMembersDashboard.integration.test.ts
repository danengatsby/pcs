import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { query } from "../../lib/db.js";
import { createApp } from "../../app.js";
import { deleteUserByEmail, deleteVolunteerByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();

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

async function insertVolunteerWithoutUser(input: {
  fullName: string;
  email: string;
  county: string;
  locality: string;
  workflowStatus: "nou" | "validat" | "contactat" | "activ";
}): Promise<void> {
  await query(
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
        internal_notes
      )
      VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, '')
    `,
    [
      input.fullName,
      input.email,
      "0712345678",
      input.county,
      input.locality,
      "organizare",
      "Implicare locala.",
      input.workflowStatus,
    ]
  );
}

test("admin members dashboard should group adherents, members and organizers", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const searchToken = `dashboard-members.${suffix}`;
  const password = "ParolaFoarteBuna#2026";

  const adminEmail = `${searchToken}.admin@example.test`;
  const aderentEmail = `${searchToken}.aderent@example.test`;
  const membruEmail = `${searchToken}.membru@example.test`;
  const consilierEmail = `${searchToken}.consilier@example.test`;

  const users = [
    { fullName: "Admin Dashboard", email: adminEmail },
    { fullName: "Aderent Dashboard", email: aderentEmail },
    { fullName: "Membru Dashboard", email: membruEmail },
    { fullName: "Consilier Dashboard", email: consilierEmail },
  ];

  try {
    for (const user of users) {
      await request(app)
        .post("/api/auth/signup")
        .send({
          fullName: user.fullName,
          email: user.email,
          password,
        })
        .expect(201);
    }

    await setUserRole(adminEmail, "PRESEDINTE");
    await setUserRole(membruEmail, "MEMBRU");
    await setUserRole(consilierEmail, "CONSILIER");

    const signinResponse = await request(app)
      .post("/api/auth/signin")
      .send({
        email: adminEmail,
        password,
      })
      .expect(200);

    const token = signinResponse.body?.data?.token as string | undefined;
    assert.equal(typeof token, "string");

    const response = await request(app)
      .get(`/api/admin/members/dashboard?search=${encodeURIComponent(searchToken)}&limit=5`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const data = response.body?.data as {
      summary: {
        total: number;
        aderenti: number;
        membri: number;
        organizatori: number;
      };
      groups: {
        aderenti: { rows: Array<{ email: string; role: string }> };
        membri: { rows: Array<{ email: string; role: string }> };
        organizatori: { rows: Array<{ email: string; role: string }> };
      };
    };

    assert.equal(data.summary.aderenti, 1);
    assert.equal(data.summary.membri, 1);
    assert.equal(data.summary.organizatori, 2);
    assert.equal(data.summary.total, 4);

    assert.deepEqual(
      data.groups.aderenti.rows.map((row) => row.email).sort(),
      [aderentEmail]
    );
    assert.deepEqual(
      data.groups.membri.rows.map((row) => row.email).sort(),
      [membruEmail]
    );
    assert.deepEqual(
      data.groups.organizatori.rows.map((row) => row.role).sort(),
      ["CONSILIER", "PRESEDINTE"]
    );
  } finally {
    for (const user of users) {
      await deleteUserByEmail(user.email);
    }
  }
});

test("admin members dashboard should include adherents derived from volunteer workflow even without auth account", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const searchToken = `dashboard-members.volunteer.${suffix}`;
  const password = "ParolaFoarteBuna#2026";

  const adminEmail = `${searchToken}.admin@example.test`;
  const volunteerEmail = `${searchToken}.aderent@example.test`;

  try {
    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Admin Dashboard Volunteer",
        email: adminEmail,
        password,
      })
      .expect(201);

    await setUserRole(adminEmail, "PRESEDINTE");

    await insertVolunteerWithoutUser({
      fullName: "Aderent Fara Cont",
      email: volunteerEmail,
      county: "Bucuresti",
      locality: "Sector 3",
      workflowStatus: "contactat",
    });

    const signinResponse = await request(app)
      .post("/api/auth/signin")
      .send({
        email: adminEmail,
        password,
      })
      .expect(200);

    const token = signinResponse.body?.data?.token as string | undefined;
    assert.equal(typeof token, "string");

    const response = await request(app)
      .get(`/api/admin/members/dashboard?search=${encodeURIComponent(searchToken)}&limit=5`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const data = response.body?.data as {
      summary: {
        total: number;
        aderenti: number;
        membri: number;
        organizatori: number;
      };
      groups: {
        aderenti: { rows: Array<{ email: string; role: string }> };
        organizatori: { rows: Array<{ email: string; role: string }> };
      };
    };

    assert.equal(data.summary.aderenti, 1);
    assert.equal(data.summary.membri, 0);
    assert.equal(data.summary.organizatori, 1);
    assert.equal(data.summary.total, 2);
    assert.deepEqual(
      data.groups.aderenti.rows.map((row) => [row.email, row.role]),
      [[volunteerEmail, "ADERENT"]]
    );
    assert.deepEqual(
      data.groups.organizatori.rows.map((row) => [row.email, row.role]),
      [[adminEmail, "PRESEDINTE"]]
    );
  } finally {
    await deleteVolunteerByEmail(volunteerEmail);
    await deleteUserByEmail(adminEmail);
  }
});

test("admin members dashboard should reject non-admin users", async () => {
  const email = `dashboard-members.nonadmin.${randomUUID().replaceAll("-", "")}@example.test`;
  const password = "ParolaFoarteBuna#2026";

  try {
    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Non Admin Dashboard",
        email,
        password,
      })
      .expect(201);

    const signinResponse = await request(app)
      .post("/api/auth/signin")
      .send({
        email,
        password,
      })
      .expect(200);

    const token = signinResponse.body?.data?.token as string | undefined;
    assert.equal(typeof token, "string");

    const response = await request(app)
      .get("/api/admin/members/dashboard")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    assert.equal(response.body?.error?.code, "AUTH_FORBIDDEN");
  } finally {
    await deleteUserByEmail(email);
  }
});
