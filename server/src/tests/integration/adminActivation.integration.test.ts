import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomBytes } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import request from "supertest";
import { createApp } from "../../app.js";
import { createFastifyServer } from "../../fastifyServer.js";
import { issueAdminActivation, previewAdminActivation, completeAdminActivation } from "../../lib/adminActivation.js";
import { manageAdminSecurity } from "../../lib/adminSecurityManagement.js";
import { createAuthToken, verifyAuthToken } from "../../lib/authToken.js";
import { query } from "../../lib/db.js";
import { closeRedisClient } from "../../lib/redisClient.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";

after(closeRedisClient);
const password = "ParolaAleasa#2026";
const oldPassword = "ParolaVeche#2026";
const operator = "operator@example.test";
const reason = "Activare nominală inițială verificată în test";
const totp = (secret: string) => new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate();
async function invite(email: string): Promise<string> {
  let token = "";
  await issueAdminActivation({ email, operator, reason, deliver: async invitation => {
    const url = new URL(invitation.url);
    assert.equal(url.pathname, "/auth/activate");
    assert.equal(url.search, "");
    token = url.hash.slice(1);
  } });
  return token;
}
async function fixture() {
  const email = buildTestEmail("admin-activation");
  const user = (await query<{ id: string }>("INSERT INTO users(full_name,email,password_hash,role) VALUES ('Titular nominal',$1,$2,'PRESEDINTE') RETURNING id::text", [email, await hashPassword(oldPassword)])).rows[0]!;
  return { email, id: user.id, token: await invite(email) };
}
async function cleanup(user: { email: string; id: string }) {
  await query("DELETE FROM admin_audit_log WHERE target_type='user' AND target_id=$1", [user.id]);
  await deleteUserByEmail(user.email);
}

for (const adapter of ["express", "fastify"] as const) {
  test(`${adapter}: invite chooses password, confirms MFA and signs in once without a second code`, async () => {
    const fastify = adapter === "fastify" ? await createFastifyServer() : null;
    await fastify?.ready();
    const app = fastify?.server ?? createApp();
    const user = await fixture();
    try {
      const invalid = await request(app).post('/api/auth/admin-activation/preview').send({ token: randomBytes(32).toString('base64url') }).expect(403);
      assert.equal(invalid.body.data, null);
      const preview = await request(app).post('/api/auth/admin-activation/preview').send({ token: user.token }).expect(200);
      assert.equal(preview.headers['cache-control'], 'private, no-store');
      assert.equal(preview.headers['set-cookie'], undefined);
      assert.equal(preview.body.data.email, user.email);
      assert.match(preview.body.data.qrDataUrl, /^data:image\/png;base64,/);
      assert.equal(preview.body.data.password, undefined);
      const stored = (await query("SELECT token_hash FROM admin_activation_invitations WHERE user_id=$1", [user.id])).rows[0];
      assert.notEqual(stored.token_hash, user.token);
      await request(app).post('/api/auth/admin-activation/complete').send({ token: user.token, password: 'short', mfaCode: totp(preview.body.data.secret) }).expect(400);
      const legacy = await createAuthToken({ id: user.id, email: user.email, fullName: 'Titular nominal', role: 'PRESEDINTE' });
      const signed = await request(app).post('/api/auth/admin-activation/complete').send({ token: user.token, password, mfaCode: totp(preview.body.data.secret) }).expect(200);
      assert.ok((await verifyAuthToken(signed.body.data.token))?.adminSessionId);
      assert.equal(signed.body.data.user.email, user.email);
      assert.equal(signed.headers['cache-control'], 'private, no-store');
      await request(app).get('/api/admin/access').set('Authorization', `Bearer ${signed.body.data.token}`).expect(200);
      await request(app).get('/api/admin/access').set('Authorization', `Bearer ${legacy}`).expect(401);
      await request(app).post('/api/auth/signin').send({ email: user.email, password: oldPassword }).expect(401);
      const noMfa = await request(app).post('/api/auth/signin').send({ email: user.email, password }).expect(403);
      assert.equal(noMfa.body.error.code, 'AUTH_MFA_REQUIRED');
      await request(app).post('/api/auth/admin-activation/preview').send({ token: user.token }).expect(403);
      await request(app).post('/api/auth/admin-activation/complete').send({ token: user.token, password, mfaCode: totp(preview.body.data.secret) }).expect(403);
      await assert.rejects(invite(user.email), /deja MFA activ/);
      const audit = (await query("SELECT action,details FROM admin_audit_log WHERE target_type='user' AND target_id=$1", [user.id])).rows;
      assert.equal(audit.filter(row => row.action === 'auth.admin_activate').length, 1);
      for (const secret of [password, user.token, preview.body.data.secret]) {assert.ok(!JSON.stringify(audit).includes(secret));}
    } finally { await cleanup(user); await fastify?.close(); }
  });
}

test('invitation expiry, renewal, role/profile changes and MFA reset fail closed', async () => {
  const user = await fixture();
  try {
    const first = await previewAdminActivation(user.token);
    const next = await invite(user.email);
    await assert.rejects(previewAdminActivation(user.token), { code: 'AUTH_ACTIVATION_INVALID' });
    assert.notEqual((await previewAdminActivation(next)).secret, first.secret);
    await query("UPDATE admin_activation_invitations SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1", [user.id]);
    await assert.rejects(previewAdminActivation(next), { code: 'AUTH_ACTIVATION_INVALID' });
    await assert.rejects(completeAdminActivation({ token: next, password, mfaCode: '123456' }), { code: 'AUTH_ACTIVATION_INVALID' });
    const profileToken = await invite(user.email);
    await manageAdminSecurity({ email: user.email, operator, reason, action: 'set-profile', profile: 'leadership' });
    await assert.rejects(previewAdminActivation(profileToken), { code: 'AUTH_ACTIVATION_INVALID' });
    const resetToken = await invite(user.email);
    await manageAdminSecurity({ email: user.email, operator, reason, action: 'reset-mfa' });
    await assert.rejects(previewAdminActivation(resetToken), { code: 'AUTH_ACTIVATION_INVALID' });
    const demotedToken = await invite(user.email);
    await query("UPDATE users SET role='MEMBRU' WHERE id=$1", [user.id]);
    await assert.rejects(previewAdminActivation(demotedToken), { code: 'AUTH_ACTIVATION_INVALID' });
    await assert.rejects(completeAdminActivation({ token: demotedToken, password, mfaCode: '123456' }), { code: 'AUTH_ACTIVATION_INVALID' });
    await assert.rejects(invite(user.email), /rol administrativ/);
  } finally { await cleanup(user); }
});

test('five wrong codes lock activation without changing the password; concurrent completion succeeds only once', async () => {
  const user = await fixture();
  try {
    const enrollment = await previewAdminActivation(user.token);
    const valid = totp(enrollment.secret);
    const invalid = valid === '000000' ? '111111' : '000000';
    for (let i = 1; i <= 5; i++) {await assert.rejects(completeAdminActivation({ token: user.token, password, mfaCode: invalid }), { code: i === 5 ? 'AUTH_MFA_LOCKED' : 'AUTH_MFA_INVALID' });}
    await assert.rejects(completeAdminActivation({ token: user.token, password, mfaCode: valid }), { code: 'AUTH_MFA_LOCKED' });
    assert.ok(await verifyPassword(oldPassword, (await query('SELECT password_hash FROM users WHERE id=$1', [user.id])).rows[0].password_hash));
    const credential = (await query('SELECT failed_attempts,enabled_at FROM admin_mfa_credentials WHERE user_id=$1', [user.id])).rows[0];
    assert.equal(credential.failed_attempts, 5);
    assert.equal(credential.enabled_at, null);
    await query("UPDATE admin_mfa_credentials SET locked_until=NOW()-INTERVAL '1 second' WHERE user_id=$1", [user.id]);
    const results = await Promise.allSettled([1, 2].map(() => completeAdminActivation({ token: user.token, password, mfaCode: totp(enrollment.secret) })));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    assert.equal((await query('SELECT 1 FROM admin_activation_invitations WHERE user_id=$1', [user.id])).rowCount, 0);
  } finally { await cleanup(user); }
});

test('failed delivery rolls back credential rotation and preserves the previous invitation', async () => {
  const user = await fixture();
  try {
    const previous = await previewAdminActivation(user.token);
    await assert.rejects(issueAdminActivation({ email: user.email, operator, reason, deliver: async () => { throw new Error('Delivery failed'); } }), /Delivery failed/);
    assert.equal((await previewAdminActivation(user.token)).secret, previous.secret);
  } finally { await cleanup(user); }
});
