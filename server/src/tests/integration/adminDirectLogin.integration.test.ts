import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { createApp } from "../../app.js";
import { createFastifyServer } from "../../fastifyServer.js";
import { issueAdminDirectLogin } from "../../lib/adminDirectLogin.js";
import { manageAdminSecurity } from "../../lib/adminSecurityManagement.js";
import { revokeAdminSession, verifyAdminSecondFactor } from "../../lib/adminMfa.js";
import { verifyAuthToken } from "../../lib/authToken.js";
import { query, closePool } from "../../lib/db.js";
import { closePrisma } from "../../lib/prisma.js";
import { closeRedisClient } from "../../lib/redisClient.js";
import { hashPassword } from "../../lib/password.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";
import { signinTestInput } from "../helpers/adminAuth.js";

after(async () => { await Promise.all([closePool(), closePrisma(), closeRedisClient()]); });
const password = "ParolaNominala#2026";
const operator = "operator@example.test";
const reason = "Acces direct personal solicitat de titular în testul izolat";
async function issue(email: string): Promise<string> {
  let token = "";
  await issueAdminDirectLogin({ email, operator, reason, deliver: async link => {
    const url = new URL(link.url);
    assert.equal(url.pathname, "/auth/signin");
    assert.equal(url.search, "");
    assert.ok(new Date(link.expiresAt).getTime() - Date.now() <= 30 * 60_000);
    token = url.hash.slice(1);
  } });
  return token;
}
async function fixture() {
  const email = buildTestEmail("direct-login");
  const user = (await query<{ id: string; email: string; fullName: string; role: "PRESEDINTE" }>(`INSERT INTO users(full_name,email,password_hash,role)
    VALUES ('Titular Direct',$1,$2,'PRESEDINTE') RETURNING id::text,email,full_name AS "fullName",role`, [email, await hashPassword(password)])).rows[0];
  const input = await signinTestInput({ email, password });
  await verifyAdminSecondFactor(user, input.mfaCode);
  return user;
}
async function cleanup(user: { id: string; email: string }) {
  await query("DELETE FROM admin_audit_log WHERE target_type='user' AND target_id=$1", [user.id]);
  await deleteUserByEmail(user.email);
}

for (const adapter of ["express", "fastify"] as const) {
  test(`${adapter}: personal link enters admin without password or TOTP, refreshes and signs out`, async () => {
    const fastify = adapter === "fastify" ? await createFastifyServer() : null;
    await fastify?.ready();
    const app = fastify?.server ?? createApp();
    const user = await fixture();
    try {
      const credentialsBefore = (await query("SELECT encrypted_secret,last_step,enabled_at FROM admin_mfa_credentials WHERE user_id=$1", [user.id])).rows[0];
      const token = await issue(user.email);
      await request(app).post('/api/auth/admin-direct-login').send({ email: user.email }).expect(400);
      await request(app).post('/api/auth/admin-direct-login').send({ token: randomBytes(32).toString('base64url') }).expect(403);
      assert.notEqual((await query('SELECT token_hash FROM admin_direct_login_links WHERE user_id=$1', [user.id])).rows[0].token_hash, token);
      const signed = await request(app).post('/api/auth/admin-direct-login').send({ token }).expect(200);
      assert.equal(signed.headers['cache-control'], 'private, no-store');
      assert.equal(signed.body.data.user.email, user.email);
      assert.equal(signed.body.data.expiresInSeconds, 900);
      assert.ok((await verifyAuthToken(signed.body.data.token))?.adminSessionId);
      await request(app).get('/api/admin/access').auth(signed.body.data.token, { type: 'bearer' }).expect(200);
      const reuse = await request(app).post('/api/auth/admin-direct-login').send({ token }).expect(403);
      assert.equal(reuse.headers['set-cookie'], undefined);
      const cookies = (signed.headers['set-cookie'] as unknown as string[]).map(cookie => cookie.split(';')[0]);
      const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', cookies).set('x-csrf-token', signed.body.data.csrfToken).send({}).expect(200);
      await request(app).get('/api/admin/access').auth(refreshed.body.data.token, { type: 'bearer' }).expect(200);
      assert.deepEqual((await query("SELECT encrypted_secret,last_step,enabled_at FROM admin_mfa_credentials WHERE user_id=$1", [user.id])).rows[0], credentialsBefore);
      const noMfa = await request(app).post('/api/auth/signin').send({ email: user.email, password }).expect(403);
      assert.equal(noMfa.body.error.code, 'AUTH_MFA_REQUIRED');
      const audit = (await query("SELECT action,details FROM admin_audit_log WHERE target_type='user' AND target_id=$1", [user.id])).rows;
      const signin = audit.find(row => row.action === 'auth.admin_signin');
      assert.ok(signin);
      assert.equal(signin.details.authenticationMethod, 'operator_link');
      assert.equal(signin.details.secondFactor, undefined);
      assert.equal(audit.filter(row => row.action === 'auth.admin_direct_link_used').length, 1);
      assert.ok(!JSON.stringify(audit).includes(token));
      await request(app).post('/api/auth/signout').auth(refreshed.body.data.token, { type: 'bearer' }).send({}).expect(200);
      await request(app).get('/api/admin/access').auth(refreshed.body.data.token, { type: 'bearer' }).expect(401);
    } finally {await cleanup(user); await fastify?.close();}
  });
}

test('direct link renewal, expiry, password/profile/role changes, reset and revoke-all prevent redemption', async () => {
  const user = await fixture();
  const app = createApp();
  const redeem = (token: string) => request(app).post('/api/auth/admin-direct-login').send({ token });
  try {
    const first = await issue(user.email);
    const second = await issue(user.email);
    await redeem(first).expect(403);
    await query("UPDATE admin_direct_login_links SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1", [user.id]);
    await redeem(second).expect(403);
    const profile = await issue(user.email);
    await manageAdminSecurity({ email: user.email, operator, reason, action: 'set-profile', profile: 'leadership' });
    await redeem(profile).expect(403);
    const changedPassword = await issue(user.email);
    await query('UPDATE users SET password_hash=$2 WHERE id=$1', [user.id, await hashPassword('ParolaSchimbata#2026')]);
    await redeem(changedPassword).expect(403);
    const changedRole = await issue(user.email);
    await query("UPDATE users SET role='MEMBRU' WHERE id=$1", [user.id]);
    await redeem(changedRole).expect(403);
    await assert.rejects(issue(user.email), /administrativ/);
    await query("UPDATE users SET role='PRESEDINTE' WHERE id=$1", [user.id]);
    const revoked = await issue(user.email);
    await revokeAdminSession({ userId: user.id });
    await redeem(revoked).expect(403);
    const reset = await issue(user.email);
    await manageAdminSecurity({ email: user.email, operator, reason, action: 'reset-mfa' });
    await redeem(reset).expect(403);
    await assert.rejects(issue(user.email), /deja activat/);
    assert.equal((await query('SELECT 1 FROM admin_auth_sessions WHERE user_id=$1', [user.id])).rowCount, 0);
  } finally {await cleanup(user);}
});

test('concurrent redemption creates one session and failed delivery preserves the previous link', async () => {
  const user = await fixture();
  const app = createApp();
  try {
    const token = await issue(user.email);
    await assert.rejects(issueAdminDirectLogin({ email: user.email, operator, reason, deliver: async () => { throw new Error('Delivery failed'); } }), /Delivery failed/);
    const results = await Promise.all([1, 2, 3].map(() => request(app).post('/api/auth/admin-direct-login').send({ token })));
    assert.deepEqual(results.map(result => result.status).sort(), [200, 403, 403]);
    assert.equal((await query('SELECT 1 FROM admin_auth_sessions WHERE user_id=$1', [user.id])).rowCount, 1);
    assert.equal((await query('SELECT 1 FROM auth_refresh_tokens WHERE user_id=$1 AND revoked_at IS NULL', [user.id])).rowCount, 1);
    assert.equal((await query('SELECT 1 FROM admin_direct_login_links WHERE user_id=$1', [user.id])).rowCount, 0);
  } finally {await cleanup(user);}
});
