import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { query } from "../../lib/db.js";
import { env } from "../../lib/env.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";

const app = createApp();

type UserCountRow = {
  total: string;
};

function readCookiePair(setCookie: string[] | string | undefined, cookieName: string): string {
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

test("auth flow should support signup/signin/me/signout with revocation", async () => {
  const email = buildTestEmail("auth-flow");
  const password = "ParolaFoarteBuna#2026";

  try {
    const signupResponse = await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Utilizator Test",
        email,
        password,
      })
      .expect(201);

    assert.equal(signupResponse.body.error, null);
    assert.equal(signupResponse.body.data?.signupAccepted, true);
    assert.equal(signupResponse.body.data?.nextStep, "signin");

    const signinResponse = await request(app)
      .post("/api/auth/signin")
      .send({
        email,
        password,
      })
      .expect(200);

    const token = signinResponse.body?.data?.token as string | undefined;
    assert.equal(typeof token, "string");
    assert.ok(token && token.length > 20);

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(meResponse.body.error, null);
    assert.equal(meResponse.body.data?.user?.email, email.toLowerCase());
    assert.equal(meResponse.body.data?.user?.role, "SUSTINATOR");

    await request(app)
      .post("/api/auth/signout")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const revokedTokenResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);

    assert.equal(revokedTokenResponse.body.error?.code, "AUTH_UNAUTHORIZED");
  } finally {
    await deleteUserByEmail(email);
  }
});

test("signup should return uniform response for both new and existing email", async () => {
  const email = buildTestEmail("auth-signup-uniform");
  const firstPassword = "ParolaFoarteBuna#2026";
  const secondPassword = "ParolaFoarteBuna#2027";

  try {
    const firstResponse = await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Utilizator Uniform 1",
        email,
        password: firstPassword,
      })
      .expect(201);

    const secondResponse = await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Utilizator Uniform 2",
        email,
        password: secondPassword,
      })
      .expect(201);

    assert.equal(firstResponse.body.error, null);
    assert.equal(secondResponse.body.error, null);
    assert.equal(firstResponse.body.data?.signupAccepted, true);
    assert.equal(secondResponse.body.data?.signupAccepted, true);
    assert.equal(firstResponse.body.data?.nextStep, "signin");
    assert.equal(secondResponse.body.data?.nextStep, "signin");
    assert.equal(firstResponse.body.data?.message, secondResponse.body.data?.message);

    const countResult = await query<UserCountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM users
        WHERE LOWER(email) = LOWER($1)
      `,
      [email]
    );
    assert.equal(Number(countResult.rows[0]?.total ?? "0"), 1);
  } finally {
    await deleteUserByEmail(email);
  }
});

test("signup should reject weak passwords", async () => {
  const email = buildTestEmail("auth-weak-password");

  try {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Utilizator Slab",
        email,
        password: "parola123",
      })
      .expect(400);

    assert.equal(response.body?.error?.code, "AUTH_SIGNUP_VALIDATION_FAILED");
  } finally {
    await deleteUserByEmail(email);
  }
});

test("refresh flow should use HttpOnly cookie + CSRF token", async () => {
  if (!env.authRefreshEnabled) {
    return;
  }

  const email = buildTestEmail("auth-refresh-cookie");
  const password = "ParolaFoarteBuna#2026";

  try {
    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Utilizator Refresh",
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

    const setCookie = signinResponse.headers["set-cookie"] as string[] | string | undefined;
    const refreshCookiePair = readCookiePair(setCookie, "pcs_refresh_token");
    const csrfCookiePair = readCookiePair(setCookie, "pcs_refresh_csrf");
    assert.ok(refreshCookiePair);
    assert.ok(csrfCookiePair);

    const setCookieList = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const refreshCookieHeader = setCookieList.find((item) => item.startsWith("pcs_refresh_token=")) ?? "";
    const csrfCookieHeader = setCookieList.find((item) => item.startsWith("pcs_refresh_csrf=")) ?? "";
    assert.match(refreshCookieHeader, /HttpOnly/i);
    assert.doesNotMatch(csrfCookieHeader, /HttpOnly/i);

    const csrfToken = signinResponse.body?.data?.csrfToken as string | undefined;
    assert.equal(typeof csrfToken, "string");
    assert.equal(typeof signinResponse.body?.data?.accessTokenExpiresAt, "string");
    assert.equal(typeof signinResponse.body?.data?.refreshTokenExpiresAt, "string");
    assert.equal(signinResponse.body?.data?.refreshExpiresInSeconds, env.authRefreshTtlSeconds);
    assert.equal(signinResponse.body?.data?.tokenPolicy?.accessTokenTtlSeconds, env.authTokenTtlSeconds);
    assert.equal(signinResponse.body?.data?.tokenPolicy?.refreshToken?.enabled, true);
    assert.equal(signinResponse.body?.data?.tokenPolicy?.refreshToken?.ttlSeconds, env.authRefreshTtlSeconds);
    assert.equal(signinResponse.body?.data?.tokenPolicy?.refreshToken?.rotation, "rotate-on-refresh");

    const refreshResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [refreshCookiePair, csrfCookiePair])
      .set("x-csrf-token", csrfToken ?? "")
      .expect(200);

    assert.equal(typeof refreshResponse.body?.data?.token, "string");
    assert.equal(typeof refreshResponse.body?.data?.csrfToken, "string");
    assert.equal(typeof refreshResponse.body?.data?.accessTokenExpiresAt, "string");
    assert.equal(typeof refreshResponse.body?.data?.refreshTokenExpiresAt, "string");
    assert.equal(refreshResponse.body?.data?.tokenPolicy?.accessTokenTtlSeconds, env.authTokenTtlSeconds);
    assert.equal(refreshResponse.body?.data?.tokenPolicy?.refreshToken?.enabled, true);
    assert.equal(refreshResponse.body?.data?.tokenPolicy?.refreshToken?.ttlSeconds, env.authRefreshTtlSeconds);
    assert.equal(refreshResponse.body?.data?.tokenPolicy?.refreshToken?.rotation, "rotate-on-refresh");
    assert.equal(refreshResponse.body?.data?.refreshToken, undefined);
  } finally {
    await deleteUserByEmail(email);
  }
});

test("auth policy endpoint should expose access/refresh TTL strategy", async () => {
  const response = await request(app)
    .get("/api/auth/policy")
    .expect(200);

  assert.equal(response.body.error, null);
  assert.equal(response.body?.data?.tokenPolicy?.accessTokenTtlSeconds, env.authTokenTtlSeconds);
  assert.equal(response.body?.data?.tokenPolicy?.refreshToken?.enabled, env.authRefreshEnabled);

  if (env.authRefreshEnabled) {
    assert.equal(response.body?.data?.tokenPolicy?.refreshToken?.ttlSeconds, env.authRefreshTtlSeconds);
    assert.equal(response.body?.data?.tokenPolicy?.refreshToken?.rotation, "rotate-on-refresh");
    assert.equal(response.body?.data?.tokenPolicy?.refreshToken?.csrfHeader, "x-csrf-token");
    assert.equal(response.body?.data?.tokenPolicy?.refreshToken?.cookiePath, "/api/auth");
    return;
  }

  assert.equal(response.body?.data?.tokenPolicy?.refreshToken?.ttlSeconds, null);
  assert.equal(response.body?.data?.tokenPolicy?.refreshToken?.rotation, "disabled");
  assert.equal(response.body?.data?.tokenPolicy?.refreshToken?.csrfHeader, null);
  assert.equal(response.body?.data?.tokenPolicy?.refreshToken?.cookiePath, null);
});

test("signout should clear refresh session even when access token is missing", async () => {
  if (!env.authRefreshEnabled) {
    return;
  }

  const email = buildTestEmail("auth-signout-refresh-only");
  const password = "ParolaFoarteBuna#2026";

  try {
    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Utilizator Signout Refresh",
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

    const setCookie = signinResponse.headers["set-cookie"] as string[] | string | undefined;
    const refreshCookiePair = readCookiePair(setCookie, "pcs_refresh_token");
    const csrfCookiePair = readCookiePair(setCookie, "pcs_refresh_csrf");
    const csrfToken = signinResponse.body?.data?.csrfToken as string | undefined;
    assert.ok(refreshCookiePair);
    assert.ok(csrfCookiePair);
    assert.equal(typeof csrfToken, "string");

    const signoutResponse = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", [refreshCookiePair, csrfCookiePair])
      .set("x-csrf-token", csrfToken ?? "")
      .expect(200);

    const signoutCookies = signoutResponse.headers["set-cookie"] as string[] | string | undefined;
    const signoutCookieList = Array.isArray(signoutCookies)
      ? signoutCookies
      : signoutCookies
        ? [signoutCookies]
        : [];

    const hasRefreshClearCookie = signoutCookieList.some((item) => item.startsWith("pcs_refresh_token="));
    const hasCsrfClearCookie = signoutCookieList.some((item) => item.startsWith("pcs_refresh_csrf="));
    assert.equal(hasRefreshClearCookie, true);
    assert.equal(hasCsrfClearCookie, true);
  } finally {
    await deleteUserByEmail(email);
  }
});

test("signout should still revoke access token when only csrf header is present", async () => {
  const email = buildTestEmail("auth-signout-bearer-only");
  const password = "ParolaFoarteBuna#2026";

  try {
    await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Utilizator Signout Bearer",
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

    await request(app)
      .post("/api/auth/signout")
      .set("Authorization", `Bearer ${token ?? ""}`)
      .set("x-csrf-token", "orphan-client-csrf-token")
      .expect(200);

    const revokedTokenResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token ?? ""}`)
      .expect(401);

    assert.equal(revokedTokenResponse.body.error?.code, "AUTH_UNAUTHORIZED");
  } finally {
    await deleteUserByEmail(email);
  }
});
