import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { env } from "../../lib/env.js";
import { query } from "../../lib/db.js";
import "../helpers/dbTestUtils.js";

test("signup rate limiting still blocks repeated requests before the honeypot on both adapters", async () => {
  const previous = { max: env.volunteerRateLimitMax, window: env.volunteerRateLimitWindowMs, proxy: env.trustProxy, store: env.rateLimitStore };
  env.volunteerRateLimitMax = 2;
  env.volunteerRateLimitWindowMs = 86_400_000;
  env.trustProxy = true;
  env.rateLimitStore = "db";
  // Import after setting limits: the shared route captures them at registration.
  const { createApp } = await import("../../app.js");
  const { createFastifyServer } = await import("../../fastifyServer.js");
  const app = createApp();
  const fastify = await createFastifyServer();
  await fastify.ready();
  const addresses = ["198.51.100.81", "198.51.100.82"];
  const hashes = addresses.map((address) => createHash("sha256").update(address).digest("hex"));
  async function cleanCounters() {
    await query("DELETE FROM rate_limit_entries WHERE scope = 'volunteers' AND key_hash = ANY($1::text[])", [hashes]);
  }
  try {
    await cleanCounters();
    for (const [index, server] of [app, fastify.server].entries()) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await request(server).post("/api/volunteers").set("X-Forwarded-For", addresses[index])
          .send({ website: "https://spam.example.test" }).expect(202);
      }
      const blocked = await request(server).post("/api/volunteers").set("X-Forwarded-For", addresses[index])
        .send({ website: "https://spam.example.test" }).expect(429);
      assert.equal(blocked.body.error.code, "RATE_LIMITED");
      assert.equal(blocked.headers["ratelimit-limit"], "2");
      assert.equal(blocked.headers["ratelimit-remaining"], "0");
    }
  } finally {
    await cleanCounters();
    await fastify.close();
    env.volunteerRateLimitMax = previous.max;
    env.volunteerRateLimitWindowMs = previous.window;
    env.trustProxy = previous.proxy;
    env.rateLimitStore = previous.store;
  }
});
