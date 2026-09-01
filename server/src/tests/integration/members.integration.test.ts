import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query } from "../../lib/db.js";
import { buildTestEmail, deleteUserByEmail, deleteVolunteerByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();

test("members route should list enrolled members with status and role", async () => {
  const email = buildTestEmail("member");
  const adminEmail = buildTestEmail("member-admin");
  const password = "ParolaFoarteBuna#2026";

  const payload = {
    fullName: "Membru Test",
    email,
    password,
    phone: "0712345678",
    county: "Bucuresti",
    locality: "Sector 3",
    skills: "organizare",
    motivation: "Particip activ la proiecte locale.",
    website: "",
  };

  try {
    await request(app)
      .get(`/api/members?search=${encodeURIComponent(email)}`)
      .expect(401);

    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Admin Membri Test",
        email: adminEmail,
        password,
      })
      .expect(201);

    await query(
      `
        UPDATE users
        SET role = 'PRESEDINTE'
        WHERE LOWER(email) = LOWER($1)
      `,
      [adminEmail]
    );

    const signinResponse = await request(app)
      .post("/api/auth/signin")
      .send({ email: adminEmail, password })
      .expect(200);

    const adminToken = signinResponse.body?.data?.token as string | undefined;
    assert.ok(adminToken);

    await request(app)
      .post("/api/volunteers")
      .send(payload)
      .expect(201);

    const response = await request(app)
      .get(`/api/members?search=${encodeURIComponent(email)}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const rows = response.body?.data as Array<{
      email: string;
      status: string;
      role: string;
    }>;

    assert.ok(Array.isArray(rows));
    const found = rows.find((row) => row.email === email.toLowerCase());
    assert.ok(found);
    assert.equal(found?.status, "nou");
    assert.equal(found?.role, "ADERENT");
  } finally {
    await deleteVolunteerByEmail(email);
    await deleteUserByEmail(email);
    await deleteUserByEmail(adminEmail);
  }
});
