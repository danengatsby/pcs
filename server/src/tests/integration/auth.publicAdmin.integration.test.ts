import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query } from "../../lib/db.js";
import { env } from "../../lib/env.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();
const directAction = { email: "admin", password: "admin" };
const password = "ParolaFoarteBuna#2026";

function readCookies(header: string[] | string | undefined): string[] {
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.map((cookie) => cookie.split(";")[0]);
}

test("public admin signin selects only the configured account and issues a revocable session", async () => {
  const originalEmail = env.authPublicAdminEmail;
  const otherEmail = buildTestEmail("other-admin");
  const targetEmail = buildTestEmail("public-admin");
  try {
    for (const email of [otherEmail, targetEmail]) {
      await request(app).post("/api/auth/signup").send({ fullName: "Administrator Test", email, password }).expect(201);
      await query("UPDATE users SET role = 'PRESEDINTE' WHERE email = $1", [email]);
    }
    env.authPublicAdminEmail = targetEmail;

    const agent = request.agent(app);
    const signin = await agent.post("/api/auth/signin").send(directAction).expect(200);
    assert.equal(signin.body.data.user.email, targetEmail);
    assert.equal(signin.body.data.user.role, "PRESEDINTE");
    assert.equal(signin.body.data.user.passwordHash, undefined);
    let token = signin.body.data.token as string;
    let csrfToken = signin.body.data.csrfToken as string | undefined;
    let cookies = readCookies(signin.headers["set-cookie"]);
    const me = await agent.get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    assert.equal(me.body.data.user.id, signin.body.data.user.id);
    await agent.get("/api/admin/access").set("Authorization", `Bearer ${token}`).expect(200);

    if (env.authRefreshEnabled) {
      const refresh = await agent.post("/api/auth/refresh")
        .set("Cookie", cookies)
        .set("x-csrf-token", signin.body.data.csrfToken).expect(200);
      assert.equal(refresh.body.data.user.email, targetEmail);
      token = refresh.body.data.token;
      csrfToken = refresh.body.data.csrfToken;
      cookies = readCookies(refresh.headers["set-cookie"]);
    }
    await agent.post("/api/auth/signout").set("Cookie", cookies)
      .set("x-csrf-token", csrfToken ?? "").set("Authorization", `Bearer ${token}`).expect(200);
    await agent.get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(401);

    // The public action does not change either account's real password.
    await request(app).post("/api/auth/signin").send({ email: targetEmail, password: "admin" }).expect(401);
    await request(app).post("/api/auth/signin").send({ email: otherEmail, password: "wrong" }).expect(401);
    await request(app).post("/api/auth/signin").send({ email: targetEmail, password }).expect(200);

    env.authPublicAdminEmail = "";
    await request(app).post("/api/auth/signin").send(directAction).expect(403);
    env.authPublicAdminEmail = buildTestEmail("missing-admin");
    await request(app).post("/api/auth/signin").send(directAction).expect(403);
    const missing = await query("SELECT id FROM users WHERE email = $1", [env.authPublicAdminEmail]);
    assert.equal(missing.rowCount, 0);

    env.authPublicAdminEmail = targetEmail;
    await query("UPDATE users SET role = 'SUSTINATOR' WHERE email = $1", [targetEmail]);
    await request(app).post("/api/auth/signin").send(directAction).expect(403);
    const unchanged = await query("SELECT role FROM users WHERE email = $1", [targetEmail]);
    assert.equal(unchanged.rows[0].role, "SUSTINATOR");
  } finally {
    env.authPublicAdminEmail = originalEmail;
    await deleteUserByEmail(otherEmail);
    await deleteUserByEmail(targetEmail);
  }
});

test("public admin attempts retain a stable rate limit and are blocked at its threshold", async () => {
  const originalEmail = env.authPublicAdminEmail;
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const accountKey = hash(hash("admin"));
  const clearLimit = () => query("DELETE FROM rate_limit_entries WHERE scope = 'auth-signin-account' AND key_hash = $1", [accountKey]);
  try {
    env.authPublicAdminEmail = "";
    await clearLimit();
    const first = await request(app).post("/api/auth/signin").send(directAction).expect(403);
    const second = await request(app).post("/api/auth/signin").send(directAction).expect(403);
    assert.equal(Number(second.headers["ratelimit-remaining"]), Number(first.headers["ratelimit-remaining"]) - 1);
    await query("UPDATE rate_limit_entries SET hits = $2 WHERE scope = 'auth-signin-account' AND key_hash = $1", [accountKey, Math.max(3, Math.floor(env.authRateLimitMax / 2))]);
    const blocked = await request(app).post("/api/auth/signin").send(directAction).expect(429);
    assert.equal(blocked.body.error.code, "AUTH_RATE_LIMITED");
  } finally {
    env.authPublicAdminEmail = originalEmail;
    await clearLimit();
  }
});
