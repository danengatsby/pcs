import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import request from "supertest";
import { query } from "../../lib/db.js";
import { buildTestEmail, deleteUserByEmail, deleteVolunteerByEmail } from "../helpers/dbTestUtils.js";
import { createRuntimeTestServer, type RuntimeTestServer } from "../helpers/runtimeTestServer.js";

let runtimeServer: RuntimeTestServer | undefined;

before(async () => {
  runtimeServer = await createRuntimeTestServer();
});

after(async () => {
  if (runtimeServer) {
    await runtimeServer.close();
  }
});

test("post-build smoke should expose live and ready health endpoints", async () => {
  const liveResponse = await request(runtimeServer!.target)
    .get("/api/health/live")
    .set("Accept-Encoding", "identity")
    .expect(200);

  assert.equal(liveResponse.body?.error, null);
  assert.equal(liveResponse.body?.data?.status, "live");

  const readyResponse = await request(runtimeServer!.target)
    .get("/api/health/ready")
    .set("Accept-Encoding", "identity")
    .expect(200);

  assert.equal(readyResponse.body?.error, null);
  assert.equal(readyResponse.body?.data?.ready, true);
});

test("post-build smoke should cover auth basic, members, and volunteers admin flows", async () => {
  const authEmail = buildTestEmail("smoke-auth");
  const adminEmail = buildTestEmail("smoke-admin");
  const volunteerEmail = buildTestEmail("smoke-volunteer");
  const password = "ParolaFoarteBuna#2026";

  try {
    await request(runtimeServer!.target)
      .post("/api/auth/signup")
      .set("Accept-Encoding", "identity")
      .send({
        fullName: "Smoke Auth",
        email: authEmail,
        password,
      })
      .expect(201);

    const signinResponse = await request(runtimeServer!.target)
      .post("/api/auth/signin")
      .set("Accept-Encoding", "identity")
      .send({
        email: authEmail,
        password,
      })
      .expect(200);

    const authToken = signinResponse.body?.data?.token as string | undefined;
    assert.ok(authToken);

    const meResponse = await request(runtimeServer!.target)
      .get("/api/auth/me")
      .set("Accept-Encoding", "identity")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    assert.equal(meResponse.body?.error, null);
    assert.equal(meResponse.body?.data?.user?.email, authEmail.toLowerCase());

    await request(runtimeServer!.target)
      .post("/api/auth/signup")
      .set("Accept-Encoding", "identity")
      .send({
        fullName: "Smoke Admin",
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

    const adminSigninResponse = await request(runtimeServer!.target)
      .post("/api/auth/signin")
      .set("Accept-Encoding", "identity")
      .send({
        email: adminEmail,
        password,
      })
      .expect(200);

    const adminToken = adminSigninResponse.body?.data?.token as string | undefined;
    assert.ok(adminToken);

    await request(runtimeServer!.target)
      .post("/api/volunteers")
      .set("Accept-Encoding", "identity")
      .send({
        fullName: "Smoke Volunteer",
        email: volunteerEmail,
        password,
        phone: "0712345678",
        county: "Iasi",
        locality: "Iasi",
        skills: "organizare",
        motivation: "Smoke test pentru fluxul de deploy compilat.",
        website: "",
      })
      .expect(201);

    const membersResponse = await request(runtimeServer!.target)
      .get(`/api/members?search=${encodeURIComponent(volunteerEmail)}`)
      .set("Accept-Encoding", "identity")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const members = membersResponse.body?.data as Array<{
      email: string;
      status: string;
      role: string;
    }> | undefined;
    const member = members?.find((item) => item.email === volunteerEmail.toLowerCase());

    assert.ok(member);
    assert.equal(member?.status, "nou");
    assert.equal(member?.role, "ADERENT");

    const adminVolunteersResponse = await request(runtimeServer!.target)
      .get(`/api/admin/volunteers?search=${encodeURIComponent(volunteerEmail)}`)
      .set("Accept-Encoding", "identity")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const volunteers = adminVolunteersResponse.body?.data as Array<{
      email: string;
      county: string;
    }> | undefined;
    const volunteer = volunteers?.find((item) => item.email === volunteerEmail.toLowerCase());

    assert.ok(volunteer);
    assert.equal(volunteer?.county, "Iași");
  } finally {
    await deleteVolunteerByEmail(volunteerEmail);
    await deleteUserByEmail(volunteerEmail);
    await deleteUserByEmail(adminEmail);
    await deleteUserByEmail(authEmail);
  }
});
