import assert from "node:assert/strict";
import { after, test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { env } from "../../lib/env.js";
import { closeRedisClient } from "../../lib/redisClient.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();

after(async () => {
  await closeRedisClient();
});

type CookieHeader = string[] | string | undefined;

function readCookiePair(setCookie: CookieHeader, cookieName: string): string {
  if (!setCookie) {
    return "";
  }

  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const cookie of list) {
    if (!cookie.startsWith(`${cookieName}=`)) {
      continue;
    }

    return cookie.split(";")[0] ?? "";
  }

  return "";
}

test("auth should revoke all refresh sessions for current user", async () => {
  if (!env.authRefreshEnabled) {
    return;
  }

  const email = buildTestEmail("auth-revoke-all");
  const password = "ParolaFoarteBuna#2026";

  try {
    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Utilizator Revoke All",
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
    const csrfToken = signinResponse.body?.data?.csrfToken as string | undefined;
    assert.equal(typeof token, "string");
    assert.equal(typeof csrfToken, "string");

    const setCookie = signinResponse.headers["set-cookie"] as CookieHeader;
    const refreshCookiePair = readCookiePair(setCookie, "pcp_refresh_token");
    const csrfCookiePair = readCookiePair(setCookie, "pcp_refresh_csrf");
    assert.ok(refreshCookiePair);
    assert.ok(csrfCookiePair);

    await request(app)
      .post("/api/auth/revoke-all")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    // refresh should now fail (401) because sessions were revoked
    await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [refreshCookiePair, csrfCookiePair])
      .set("x-csrf-token", csrfToken ?? "")
      .expect(401);
  } finally {
    await deleteUserByEmail(email);
  }
});
