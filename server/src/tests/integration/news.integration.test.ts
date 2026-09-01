import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query } from "../../lib/db.js";
import {
  buildTestEmail,
  buildTestNewsTitle,
  deleteNewsById,
  deleteUserByEmail,
} from "../helpers/dbTestUtils.js";

const app = createApp();

test("admin should create and read news through API", async () => {
  const email = buildTestEmail("news-admin");
  const password = "ParolaFoarteBuna#2026";
  const title = buildTestNewsTitle("PRESEDINTE");
  let createdNewsId = 0;

  try {
    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Admin Test",
        email,
        password,
      })
      .expect(201);

    await query(
      `
        UPDATE users
        SET role = 'PRESEDINTE'
        WHERE LOWER(email) = LOWER($1)
      `,
      [email]
    );

    const signinResponse = await request(app)
      .post("/api/auth/signin")
      .send({
        email,
        password,
      })
      .expect(200);

    const token = signinResponse.body?.data?.token as string | undefined;
    assert.equal(typeof token, "string");

    const createNewsResponse = await request(app)
      .post("/api/news")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title,
        summary: "Acesta este un sumar valid pentru integrare API news.",
        category: "Comunicat",
        content: "Acesta este continutul complet al stirii pentru testarea fluxului admin.",
        sourceName: "Sursa de integrare",
        sourceUrl: "https://example.test/stire-sursa",
      })
      .expect(201);

    createdNewsId = Number(createNewsResponse.body?.data?.news?.id ?? 0);
    assert.ok(createdNewsId > 0);

    const detailResponse = await request(app)
      .get(`/api/news/${createdNewsId}`)
      .expect(200);

    assert.equal(detailResponse.body?.data?.id, createdNewsId);
    assert.equal(detailResponse.body?.data?.title, title);
    assert.equal(detailResponse.body?.data?.sourceName, "Sursa de integrare");
    assert.equal(detailResponse.body?.data?.sourceUrl, "https://example.test/stire-sursa");
  } finally {
    if (createdNewsId > 0) {
      await deleteNewsById(createdNewsId);
    }
    await deleteUserByEmail(email);
  }
});
