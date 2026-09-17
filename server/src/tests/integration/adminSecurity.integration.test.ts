import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { createFastifyServer } from "../../fastifyServer.js";
import { createAuthToken, verifyAuthToken } from "../../lib/authToken.js";
import { createRefreshTokenSession } from "../../lib/authRefreshToken.js";
import { query } from "../../lib/db.js";
import { manageAdminSecurity } from "../../lib/adminSecurityManagement.js";
import { profileCapabilities, type AdminProfile } from "../../lib/adminAccessProfiles.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";
import { signinTestInput } from "../helpers/adminAuth.js";
import { closeRedisClient } from "../../lib/redisClient.js";

after(closeRedisClient);

const password = "ParolaPersonala#2026";
const operator = "operator@example.test";
const reason = "Schimbare nominală verificată pentru testul de securitate";
function cookies(header: string[] | string | undefined): string[] {
  return (Array.isArray(header) ? header : header ? [header] : []).map((value) => value.split(";")[0]);
}

for (const adapter of ["express", "fastify"] as const) {
  test(`${adapter}: admin password + TOTP, legacy-session rejection, replay protection, refresh and reset`, async () => {
    const fastify = adapter === "fastify" ? await createFastifyServer() : null;
    await fastify?.ready();
    const app = fastify?.server ?? createApp();
    const email = buildTestEmail("individual-admin");
    const previousPublicAdmin = process.env.AUTH_PUBLIC_ADMIN_EMAIL;
    try {
      await request(app).post("/api/auth/signup").send({ fullName: "Administrator nominal", email, password }).expect(201);
      await query("UPDATE users SET role = 'PRESEDINTE' WHERE email = $1", [email]);
      const user = (await query<{ id: string; fullName: string }>('SELECT id::text, full_name AS "fullName" FROM users WHERE email = $1', [email])).rows[0];
      const actor = { ...user, email, role: "PRESEDINTE" as const };
      process.env.AUTH_PUBLIC_ADMIN_EMAIL = email;
      const bypass = await request(app).post("/api/auth/signin").send({ email: "admin", password: "admin" }).expect(401);
      assert.equal(bypass.body.data, null);
      assert.equal(bypass.headers["set-cookie"], undefined);
      const setup = await request(app).post("/api/auth/signin").send({ email, password }).expect(403);
      assert.equal(setup.body.error.code, "AUTH_MFA_SETUP_REQUIRED");
      const legacyToken = await createAuthToken(actor);
      await request(app).get("/api/admin/access").set("Authorization", `Bearer ${legacyToken}`).expect(401);
      const legacyRefresh = await createRefreshTokenSession({ userId: user.id, user: actor });
      assert.ok(legacyRefresh);
      await request(app).post("/api/auth/refresh").set("Cookie", [`pcs_refresh_token=${legacyRefresh.token}`, `pcs_refresh_csrf=${legacyRefresh.csrfToken}`])
        .set("x-csrf-token", legacyRefresh.csrfToken).expect(401);

      const input = await signinTestInput({ email, password });
      const required = await request(app).post("/api/auth/signin").send({ email, password }).expect(403);
      assert.equal(required.body.error.code, "AUTH_MFA_REQUIRED");
      assert.equal(required.headers["set-cookie"], undefined);
      await request(app).post("/api/auth/signin").send({ ...input, password: "ParolaGresita#2026" }).expect(401);
      const signin = await request(app).post("/api/auth/signin").send(input).expect(200);
      assert.equal(signin.body.data.user.email, email);
      assert.ok(signin.body.data.expiresInSeconds <= 900);
      assert.equal(signin.headers["cache-control"], "private, no-store");
      const payload = await verifyAuthToken(signin.body.data.token);
      assert.ok(payload?.adminSessionId);
      await request(app).get("/api/admin/access").set("Authorization", `Bearer ${signin.body.data.token}`).expect(200);
      const replay = await request(app).post("/api/auth/signin").send(input).expect(403);
      assert.equal(replay.body.error.code, "AUTH_MFA_INVALID");

      const refresh = await request(app).post("/api/auth/refresh").set("Cookie", cookies(signin.headers["set-cookie"]))
        .set("x-csrf-token", signin.body.data.csrfToken).expect(200);
      assert.equal((await verifyAuthToken(refresh.body.data.token))?.adminSessionId, payload.adminSessionId);
      await request(app).get("/api/admin/access").set("Authorization", `Bearer ${refresh.body.data.token}`).expect(200);
      const audit = await query("SELECT actor_user_id::text, details FROM admin_audit_log WHERE action = 'auth.admin_signin' AND target_id = $1", [user.id]);
      assert.equal(audit.rows[0].actor_user_id, user.id);
      assert.equal(audit.rows[0].details.secondFactor, "totp");

      await manageAdminSecurity({ email, operator, reason, action: "reset-mfa" });
      await request(app).get("/api/admin/access").set("Authorization", `Bearer ${refresh.body.data.token}`).expect(401);
      await request(app).post("/api/auth/refresh").set("Cookie", cookies(refresh.headers["set-cookie"]))
        .set("x-csrf-token", refresh.body.data.csrfToken).expect(401);
      const reset = await request(app).post("/api/auth/signin").send(input).expect(403);
      assert.equal(reset.body.error.code, "AUTH_MFA_SETUP_REQUIRED");
    } finally {
      if (previousPublicAdmin === undefined) { delete process.env.AUTH_PUBLIC_ADMIN_EMAIL; }
      else { process.env.AUTH_PUBLIC_ADMIN_EMAIL = previousPublicAdmin; }
      await deleteUserByEmail(email);
      await fastify?.close();
    }
  });
}

test("promotion to an administrative role rejects existing password-only access and refresh sessions", async () => {
  const app = createApp();
  const email = buildTestEmail("promoted-admin");
  try {
    await request(app).post("/api/auth/signup").send({ fullName: "Utilizator promovat", email, password }).expect(201);
    const signin = await request(app).post("/api/auth/signin").send({ email, password }).expect(200);
    assert.equal((await verifyAuthToken(signin.body.data.token))?.adminSessionId, undefined);
    await query("UPDATE users SET role = 'PRESEDINTE' WHERE email = $1", [email]);
    await request(app).get("/api/admin/access").set("Authorization", `Bearer ${signin.body.data.token}`).expect(401);
    const refresh = await request(app).post("/api/auth/refresh").set("Cookie", cookies(signin.headers["set-cookie"]))
      .set("x-csrf-token", signin.body.data.csrfToken).expect(401);
    assert.equal(refresh.body.error.code, "AUTH_MFA_SESSION_REQUIRED");
  } finally { await deleteUserByEmail(email); }
});

test("arbitration can select scoped organization names without accessing the organization registry", async () => {
  const app = createApp();
  const email = buildTestEmail("territorial-arbitrator");
  const localId = `mfa-${randomUUID()}`;
  const outsideId = `mfa-${randomUUID()}`;
  try {
    await request(app).post("/api/auth/signup").send({ fullName: "Arbitru teritorial", email, password }).expect(201);
    await query("UPDATE users SET role = 'CONSILIER' WHERE email = $1", [email]);
    await manageAdminSecurity({ email, operator, reason, action: "set-profile", profile: "arbitration" });
    const signin = await request(app).post("/api/auth/signin").send(await signinTestInput({ email, password })).expect(200);
    const authorization = { Authorization: `Bearer ${signin.body.data.token}` };
    await request(app).get("/api/admin/organization-options").set(authorization).expect(403);
    await query(`INSERT INTO organizations (id, code, name, county, level, status)
      VALUES ($1, $1, 'Filiala autorizată', 'Cluj', 'county', 'active'), ($2, $2, 'Altă filială', 'Iași', 'county', 'active')`, [localId, outsideId]);
    await query(`INSERT INTO organization_leadership_mandates (organization_id, user_id, full_name, position_title, started_at, status)
      VALUES ($1, $2, 'Arbitru teritorial', 'Arbitru', CURRENT_DATE, 'active')`, [localId, signin.body.data.user.id]);
    const options = await request(app).get("/api/admin/organization-options?limit=1&offset=0").set(authorization).expect(200);
    assert.deepEqual(options.body.data, { rows: [{ id: localId, name: "Filiala autorizată" }], total: 1 });
    const nextPage = await request(app).get("/api/admin/organization-options?limit=1&offset=1").set(authorization).expect(200);
    assert.deepEqual(nextPage.body.data, { rows: [], total: 1 });
    await request(app).get("/api/admin/organization-options?limit=201").set(authorization).expect(400);
    await request(app).get("/api/admin/organizations").set(authorization).expect(403);
    await request(app).get(`/api/admin/organizations/${localId}`).set(authorization).expect(403);
  } finally {
    await query("DELETE FROM organization_leadership_mandates WHERE organization_id = $1", [localId]);
    await query("DELETE FROM organizations WHERE id IN ($1, $2)", [localId, outsideId]);
    await deleteUserByEmail(email);
  }
});

test("operator enrollment writes a private file, refuses overwrite and audits enrollment and recovery without secrets", async () => {
  const app = createApp();
  const email = buildTestEmail("cli-admin");
  const directory = await mkdtemp(join(tmpdir(), "pcs-mfa-enrollment-test-"));
  const output = join(directory, "enrollment.json");
  const run = (action: string, extra: string[] = []) => spawnSync(process.execPath, [
    fileURLToPath(new URL("../../scripts/adminSecurity.js", import.meta.url)),
    action, "--email", email, "--operator", operator, "--reason", reason, ...extra,
  ], { env: process.env, encoding: "utf8", timeout: 15000 });
  try {
    await request(app).post("/api/auth/signup").send({ fullName: "Administrator înrolare", email, password }).expect(201);
    await query("UPDATE users SET role = 'PRESEDINTE' WHERE email = $1", [email]);
    const enrollment = run("enroll-mfa", ["--output", output]);
    assert.equal(enrollment.status, 0, enrollment.stderr);
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    const file = await readFile(output, "utf8");
    const secret = JSON.parse(file).secret as string;
    assert.match(secret, /^[A-Z2-7]+$/);
    assert.ok(!enrollment.stdout.includes(secret) && !enrollment.stderr.includes(secret));
    assert.equal(run("enroll-mfa", ["--output", output]).status, 1);
    assert.equal(await readFile(output, "utf8"), file);
    const reset = run("reset-mfa");
    assert.equal(reset.status, 0, reset.stderr);
    const credentials = await query("SELECT 1 FROM admin_mfa_credentials WHERE user_id = (SELECT id FROM users WHERE email = $1)", [email]);
    assert.equal(credentials.rowCount, 0);
    const audit = await query(`SELECT action, actor_email, details FROM admin_audit_log
      WHERE target_id = (SELECT id::text FROM users WHERE email = $1) ORDER BY id`, [email]);
    assert.deepEqual(audit.rows.map((row) => row.action), ["auth.admin_enroll_mfa", "auth.admin_reset_mfa"]);
    assert.ok(audit.rows.every((row) => row.actor_email === operator && row.details.reason === reason));
    assert.ok(!JSON.stringify(audit.rows).includes(secret));
  } finally {
    await rm(directory, { recursive: true, force: true });
    await deleteUserByEmail(email);
  }
});

test("MFA attempts share an account lock and a consumed code cannot succeed concurrently", async () => {
  const app = createApp();
  const email = buildTestEmail("locked-admin");
  try {
    await request(app).post("/api/auth/signup").send({ fullName: "Administrator verificare", email, password }).expect(201);
    await query("UPDATE users SET role = 'PRESEDINTE' WHERE email = $1", [email]);
    const input = await signinTestInput({ email, password });
    const responses = await Promise.all([1, 2].map(() => request(app).post("/api/auth/signin").send(input)));
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 403]);
    for (let index = 0; index < 4; index++) {
      const response = await request(app).post("/api/auth/signin").send(input);
      assert.equal(response.status, index === 3 ? 429 : 403);
    }
    const next = await signinTestInput({ email, password });
    const locked = await request(app).post("/api/auth/signin").send(next).expect(429);
    assert.equal(locked.body.error.code, "AUTH_MFA_LOCKED");
    await query("UPDATE admin_mfa_credentials SET locked_until = NOW() - INTERVAL '1 second' WHERE user_id = (SELECT id FROM users WHERE email = $1)", [email]);
    const signin = await request(app).post("/api/auth/signin").send(next).expect(200);
    await query("UPDATE admin_auth_sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE user_id = (SELECT id FROM users WHERE email = $1)", [email]);
    await request(app).get("/api/admin/access").set("Authorization", `Bearer ${signin.body.data.token}`).expect(401);
    await request(app).post("/api/auth/refresh").set("Cookie", cookies(signin.headers["set-cookie"]))
      .set("x-csrf-token", signin.body.data.csrfToken).expect(401);
  } finally { await deleteUserByEmail(email); }
});

test("explicit duty profiles replace political-role permissions and revoke existing sessions", async () => {
  const app = createApp();
  for (const profile of ["secretariat", "communications", "treasury", "parliamentary", "arbitration"] as AdminProfile[]) {
    const email = buildTestEmail(`profile-${profile}`);
    try {
      await request(app).post("/api/auth/signup").send({ fullName: "Responsabil nominal", email, password }).expect(201);
      await query("UPDATE users SET role = 'PRESEDINTE' WHERE email = $1", [email]);
      const signin = await request(app).post("/api/auth/signin").send(await signinTestInput({ email, password })).expect(200);
      const original = await request(app).get("/api/admin/access").set("Authorization", `Bearer ${signin.body.data.token}`).expect(200);
      assert.ok(!original.body.data.capabilities.includes("arbitration.read"));
      await manageAdminSecurity({ email, operator, reason, action: "set-profile", profile });
      await request(app).get("/api/admin/access").set("Authorization", `Bearer ${signin.body.data.token}`).expect(401);
      const next = await request(app).post("/api/auth/signin").send(await signinTestInput({ email, password })).expect(200);
      const authorization = { Authorization: `Bearer ${next.body.data.token}` };
      const access = await request(app).get("/api/admin/access").set(authorization).expect(200);
      assert.equal(access.body.data.profile, profile);
      assert.deepEqual(access.body.data.capabilities, profileCapabilities[profile]);
      const tasks = await request(app).get("/api/admin/tasks").set(authorization).expect(200);
      if (profile !== "secretariat") {
        await request(app).get("/api/admin/volunteers").set(authorization).expect(403);
        assert.equal(tasks.body.data.counts.volunteers, undefined);
      }
      if (profile !== "arbitration") {
        await request(app).get("/api/admin/arbitration/cases").set(authorization).expect(403);
      } else {
        await request(app).get("/api/admin/arbitration/cases").set(authorization).expect(200);
      }
    } finally { await deleteUserByEmail(email); }
  }
});
