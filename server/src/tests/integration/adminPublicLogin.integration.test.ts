import assert from "node:assert/strict";
import { after, test } from "node:test";
import request from "supertest";
import { createApp } from "../../app.js";
import { createFastifyServer } from "../../fastifyServer.js";
import { env } from "../../lib/env.js";
import { publicAdminEmail } from "../../lib/adminPublicAccess.js";
import { createAuthToken, verifyAuthToken } from "../../lib/authToken.js";
import { query, closePool } from "../../lib/db.js";
import { closePrisma } from "../../lib/prisma.js";
import { closeRedisClient } from "../../lib/redisClient.js";
import { hashPassword } from "../../lib/password.js";
import { buildTestEmail, deleteUserByEmail } from "../helpers/dbTestUtils.js";

after(async () => { await Promise.all([closePool(), closePrisma(), closeRedisClient()]); });

for (const adapter of ["express", "fastify"] as const) {
  test(`${adapter}: anyone can enter the enabled public account, refresh and sign out; personal accounts still require MFA`, async () => {
    const previous = env.authPublicAdminEnabled;
    const fastify = adapter === "fastify" ? await createFastifyServer() : null;
    await fastify?.ready();
    const app = fastify?.server ?? createApp();
    const email = buildTestEmail("personal-admin-guard");
    try {
      env.authPublicAdminEnabled = false;
      await request(app).post('/api/auth/admin-public-login').send({}).expect(403);
      env.authPublicAdminEnabled = true;
      const [first, second] = await Promise.all([1, 2].map(() => request(app).post('/api/auth/admin-public-login').send({}).expect(200)));
      assert.equal(first.headers['cache-control'], 'private, no-store');
      assert.equal(first.body.data.user.email, publicAdminEmail);
      assert.equal(first.body.data.user.fullName, 'Administrator public PCS');
      assert.equal(first.body.data.user.id, second.body.data.user.id);
      assert.notEqual(first.body.data.token, second.body.data.token);
      assert.equal(first.body.data.expiresInSeconds, 900);
      assert.equal((await verifyAuthToken(first.body.data.token))?.adminSessionId, undefined);
      await request(app).get('/api/admin/access').auth(first.body.data.token, { type: 'bearer' }).expect(200);
      await request(app).get('/api/admin/access').expect(401);
      const cookies = (first.headers['set-cookie'] as unknown as string[]).map(cookie => cookie.split(';')[0]);
      const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', cookies).set('x-csrf-token', first.body.data.csrfToken).send({}).expect(200);
      await request(app).get('/api/admin/access').auth(refreshed.body.data.token, { type: 'bearer' }).expect(200);
      const audit = (await query("SELECT details FROM admin_audit_log WHERE action='auth.admin_public_signin' AND target_id=$1", [first.body.data.user.id])).rows;
      assert.ok(audit.length >= 2);
      assert.ok(audit.every(row => row.details.authenticationMethod === 'public' && !row.details.secondFactor));
      // Enabling public entry never grants access as an unrelated real account.
      const person = (await query<{ id: string; email: string; fullName: string; role: 'PRESEDINTE' }>(`INSERT INTO users(full_name,email,password_hash,role)
        VALUES ('Administrator personal',$1,$2,'PRESEDINTE') RETURNING id::text,email,full_name AS "fullName",role`, [email, await hashPassword('ParolaPersonala#2026')])).rows[0];
      const personalToken = await createAuthToken(person);
      await request(app).get('/api/admin/access').auth(personalToken, { type: 'bearer' }).expect(401);
      await request(app).post('/api/auth/signout').auth(refreshed.body.data.token, { type: 'bearer' }).send({}).expect(200);
      await request(app).get('/api/admin/access').auth(refreshed.body.data.token, { type: 'bearer' }).expect(401);
      // A different visitor's session survives another visitor's logout.
      await request(app).get('/api/admin/access').auth(second.body.data.token, { type: 'bearer' }).expect(200);
      env.authPublicAdminEnabled = false;
      await request(app).get('/api/admin/access').auth(second.body.data.token, { type: 'bearer' }).expect(401);
      const secondCookies = (second.headers['set-cookie'] as unknown as string[]).map(cookie => cookie.split(';')[0]);
      await request(app).post('/api/auth/refresh').set('Cookie', secondCookies).set('x-csrf-token', second.body.data.csrfToken).send({}).expect(401);
    } finally {
      env.authPublicAdminEnabled = previous;
      await query("DELETE FROM admin_audit_log WHERE target_type='user' AND target_id=(SELECT id::text FROM users WHERE email=$1)", [publicAdminEmail]);
      await deleteUserByEmail(publicAdminEmail);
      await deleteUserByEmail(email);
      await fastify?.close();
    }
  });
}
