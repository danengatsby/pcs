import { expect, test } from '@playwright/test';
import { issueAdminDirectLogin } from '../../../server/src/lib/adminDirectLogin';
import { buildTestEmail, deleteUserByEmail, prepareAdminMfa, query, setUserRole } from './helpers/testDb';
import { signupUser, signOutThroughUi } from './helpers/auth';

test('signin exposes direct access through a personal link, keeps it private and preserves the session', async ({ page, request, browser }) => {
  const email = buildTestEmail('personal-link-browser');
  const password = 'ParolaNominala#2026';
  let directUrl = '';
  try {
    await signupUser(request, { email, fullName: 'Titular Acces Direct', password });
    await setUserRole(email, 'PRESEDINTE');
    const mfaCode = await prepareAdminMfa(email);
    expect((await request.post('/api/auth/signin', { data: { email, password, mfaCode } })).ok()).toBeTruthy();
    await request.post('/api/auth/signout');
    await issueAdminDirectLogin({ email, operator: 'operator@example.test', reason: 'Acces direct solicitat de titular în testul browser izolat', deliver: async link => { directUrl = link.url; } });
    const link = new URL(directUrl);
    const token = link.hash.slice(1);
    let redeemed = 0;
    const requestedUrls: string[] = [];
    page.on('request', outgoing => { requestedUrls.push(outgoing.url()); if (outgoing.url().endsWith('/api/auth/admin-direct-login')) redeemed++; });
    await page.goto(link.pathname + link.hash);
    await expect(page).toHaveURL(/\/admin$/);
    expect(redeemed).toBe(1);
    await expect(page.getByLabel('Link personal de acces')).toHaveCount(0);
    const visitor = await browser.newContext();
    try {
      const publicPage = await visitor.newPage();
      await publicPage.goto(new URL('/auth/signin', page.url()).toString());
      await expect(publicPage.getByRole('button', { name: 'Intră direct ca administrator', exact: true })).toBeVisible();
      await expect(publicPage.getByLabel('Link personal de acces')).toHaveCount(0);
      expect(await publicPage.content()).not.toContain(token);
      expect((await visitor.request.get(new URL('/api/admin/access', page.url()).toString())).status()).toBe(401);
    } finally { await visitor.close(); }
    await expect(page.getByRole('heading', { name: 'Administrare', exact: true })).toBeVisible();
    await expect(page.getByText('Titular Acces Direct', { exact: true }).first()).toBeVisible();
    expect(redeemed).toBe(1);
    expect(requestedUrls.every(url => !url.includes(token))).toBeTruthy();
    expect(new URL(page.url()).hash).toBe('');
    const stored = await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage }));
    expect(stored).not.toContain(token);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Administrare', exact: true })).toBeVisible();
    // Independently opened tabs have no sessionStorage but share the browser's
    // valid refresh session. Concurrent restoration must not race its rotation.
    const tabs = await Promise.all([page.context().newPage(), page.context().newPage()]);
    try {
      await Promise.all(tabs.map(async tab => {
        await tab.goto(new URL('/auth/signin', page.url()).toString());
        await expect(tab).toHaveURL(/\/admin$/);
        await expect(tab.getByRole('heading', { name: 'Administrare', exact: true })).toBeVisible();
        expect(await tab.evaluate(() => sessionStorage.getItem('pcs.auth.session'))).toBeNull();
      }));
      // The first tab can refresh again using the newest shared CSRF value.
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Administrare', exact: true })).toBeVisible();
      await signOutThroughUi(page);
      await Promise.all(tabs.map(async tab => {
        await expect(tab).toHaveURL(/\/auth\/signin$/);
        await expect(tab.getByLabel('Parolă', { exact: true })).toBeVisible();
      }));
    } finally { await Promise.all(tabs.map(tab => tab.close())); }
    // Existing /auth/direct links keep the automatic one-use flow.
    await page.goto('/auth/direct' + link.hash);
    await expect(page.getByRole('alert')).toContainText('Linkul de acces direct a expirat');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/auth\/signin$/);
  } finally {
    await query("DELETE FROM admin_audit_log WHERE target_type='user' AND target_id=(SELECT id::text FROM users WHERE email=$1)", [email]);
    await deleteUserByEmail(email);
  }
});
