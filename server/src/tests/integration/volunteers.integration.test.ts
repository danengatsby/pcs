import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { createFastifyServer } from "../../fastifyServer.js";
import { query } from "../../lib/db.js";
import { buildTestEmail, deleteUserByEmail, deleteVolunteerByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();

test("signup works without an external verification service and retains the honeypot on both adapters", async (context) => {
  const outbound = context.mock.method(globalThis, "fetch", async () => { throw new Error("Signup must not call an external verification service"); });
  const fastify = await createFastifyServer();
  await fastify.ready();
  try {
    for (const [name, server] of [["express", app], ["fastify", fastify.server]] as const) {
      const email = buildTestEmail(`signup-local-${name}`);
      const botEmail = buildTestEmail(`signup-honeypot-${name}`);
      const payload = { fullName: "Cerere fără serviciu extern", email, password: "ParolaFoarteBuna#2026", county: "Cluj", locality: "Cluj-Napoca", motivation: "Vreau sa particip la activitati comunitare.", website: "" };
      try {
        const created = await request(server).post("/api/volunteers").send(payload).expect(201);
        assert.ok(created.body.data.id > 0);
        assert.ok(Number(created.headers["ratelimit-limit"]) > 0);
        assert.equal(outbound.mock.callCount(), 0);
        const bot = await request(server).post("/api/volunteers").send({ ...payload, email: botEmail, website: "https://spam.example.test" }).expect(202);
        assert.equal(bot.body.data.ignored, true);
        const count = await query<{ total: number }>("SELECT ((SELECT COUNT(*) FROM volunteers WHERE email = $1) + (SELECT COUNT(*) FROM users WHERE email = $1) + (SELECT COUNT(*) FROM membership_records WHERE email = $1))::int AS total", [botEmail]);
        assert.equal(count.rows[0].total, 0);
        assert.equal(outbound.mock.callCount(), 0);
      } finally {
        for (const address of [email, botEmail]) {
          await deleteVolunteerByEmail(address);
          await deleteUserByEmail(address);
        }
      }
    }
  } finally { await fastify.close(); }
});

test("volunteers route should create volunteer and reject duplicate email", async () => {
  const email = buildTestEmail("volunteer");

  const payload = {
    fullName: "Voluntar Test",
    email,
    password: "ParolaFoarteBuna#2026",
    phone: "0712345678",
    county: "Cluj",
    locality: "Cluj-Napoca",
    skills: "organizare, comunicare",
    motivation: "Vreau sa contribui la proiecte locale si la activitati comunitare.",
  };

  try {
    const createResponse = await request(app)
      .post("/api/volunteers")
      .send(payload)
      .expect(201);

    assert.equal(createResponse.body.error, null);
    assert.ok(Number(createResponse.body?.data?.id) > 0);

    await request(app).get("/api/volunteers").expect(404);

    const duplicateResponse = await request(app)
      .post("/api/volunteers")
      .send(payload)
      .expect(409);

    assert.equal(duplicateResponse.body?.error?.code, "VOLUNTEER_EMAIL_EXISTS");
  } finally {
    await deleteVolunteerByEmail(email);
    await deleteUserByEmail(email);
  }
});

test("volunteers route should expose the official county list", async () => {
  const response = await request(app)
    .get("/api/volunteers/counties")
    .expect(200);

  const counties = response.body?.data as string[] | undefined;
  assert.ok(Array.isArray(counties));
  assert.equal(counties.length, 42);
  assert.ok(counties.includes("București"));
  assert.ok(counties.includes("Iași"));
});

test("volunteers route should not expose county aggregation", async () => {
  await request(app).get("/api/volunteers/by-county").expect(404);
});

test("volunteers route should reject weak passwords", async () => {
  const response = await request(app)
    .post("/api/volunteers")
    .send({
      fullName: "Voluntar Parola Slaba",
      email: buildTestEmail("volunteer-weak-password"),
      password: "slab",
      phone: "0712345678",
      county: "Cluj",
      locality: "Cluj-Napoca",
      skills: "organizare",
      motivation: "Vreau sa contribui la proiecte locale si activitati comunitare.",
    })
    .expect(400);

  assert.equal(response.body?.error?.code, "VOLUNTEER_VALIDATION_FAILED");
  assert.match(response.body?.error?.message ?? "", /Parola trebuie/i);
});
