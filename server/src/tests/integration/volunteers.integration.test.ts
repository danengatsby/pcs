import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { env } from "../../lib/env.js";
import { buildTestEmail, deleteUserByEmail, deleteVolunteerByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();

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

test("volunteers route should require captcha when configured as required", async () => {
  const previousCaptchaMode = env.captchaMode;
  const previousCaptchaSecret = env.captchaSecret;

  try {
    env.captchaMode = "required";
    env.captchaSecret = "test_secret";

    const response = await request(app)
      .post("/api/volunteers")
      .send({
        fullName: "Voluntar Fara Captcha",
        email: buildTestEmail("volunteer-captcha-required"),
        password: "ParolaFoarteBuna#2026",
        phone: "0712345678",
        county: "Cluj",
        locality: "Cluj-Napoca",
        skills: "organizare",
        motivation: "Vreau sa contribui la proiecte locale si activitati comunitare.",
      })
      .expect(400);

    assert.equal(response.body?.error?.code, "VOLUNTEER_CAPTCHA_REQUIRED");
  } finally {
    env.captchaMode = previousCaptchaMode;
    env.captchaSecret = previousCaptchaSecret;
  }
});

test("volunteers route should accept a valid captcha token when captcha is required", async () => {
  const email = buildTestEmail("volunteer-captcha-valid");
  const previousCaptchaMode = env.captchaMode;
  const previousCaptchaSecret = env.captchaSecret;
  const previousCaptchaExpectedAction = env.captchaExpectedAction;
  const previousCaptchaExpectedHostname = env.captchaExpectedHostname;
  const previousCaptchaMinScore = env.captchaMinScore;
  const previousFetch = globalThis.fetch;

  try {
    env.captchaMode = "required";
    env.captchaSecret = "test_secret";
    env.captchaExpectedAction = "volunteer_signup";
    env.captchaExpectedHostname = "";
    env.captchaMinScore = null;

    globalThis.fetch = (async (_input, init) => {
      const body = init?.body;
      assert.ok(body instanceof URLSearchParams);
      assert.equal(body.get("response"), "captcha-token-ok");
      assert.equal(body.get("secret"), "test_secret");

      return new Response(
        JSON.stringify({
          success: true,
          action: "volunteer_signup",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }) as typeof fetch;

    const response = await request(app)
      .post("/api/volunteers")
      .send({
        fullName: "Voluntar Captcha Valid",
        email,
        password: "ParolaFoarteBuna#2026",
        phone: "0712345678",
        county: "Cluj",
        locality: "Cluj-Napoca",
        skills: "organizare",
        motivation: "Vreau sa contribui la proiecte locale si activitati comunitare.",
        captchaToken: "captcha-token-ok",
      })
      .expect(201);

    assert.equal(response.body?.error, null);
    assert.ok(Number(response.body?.data?.id) > 0);
  } finally {
    globalThis.fetch = previousFetch;
    env.captchaMode = previousCaptchaMode;
    env.captchaSecret = previousCaptchaSecret;
    env.captchaExpectedAction = previousCaptchaExpectedAction;
    env.captchaExpectedHostname = previousCaptchaExpectedHostname;
    env.captchaMinScore = previousCaptchaMinScore;
    await deleteVolunteerByEmail(email);
    await deleteUserByEmail(email);
  }
});
