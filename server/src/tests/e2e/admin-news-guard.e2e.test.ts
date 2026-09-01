import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";

const app = createApp();

test("POST /api/news should reject unauthenticated requests", async () => {
  const response = await request(app)
    .post("/api/news")
    .send({
      title: "Test",
      summary: "Acesta este un sumar valid pentru test.",
      category: "Comunicat",
      content: "Acesta este continutul complet pentru testul endpoint-ului administrativ.",
    })
    .expect(401);

  const payload = response.body as {
    error: { code: string; message: string };
  };
  assert.equal(payload.error.code, "AUTH_UNAUTHORIZED");
});
