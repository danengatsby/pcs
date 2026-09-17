import { expect, test } from '@playwright/test';
import { createAuthToken, verifyAuthToken } from '../../../server/src/lib/authToken';
import { signupUser } from './helpers/auth';
import { buildTestEmail, deleteMembershipByEmail, deleteUserByEmail, prepareAdminMfa, query, setUserRole } from './helpers/testDb';

test('expired access tokens refresh once across both clients; an expired MFA session returns to signin', async ({ page, request }) => {
  const email = buildTestEmail('session-renewal');
  const password = 'ParolaPersonala#2026';
  let releaseRefresh = () => {};
  try {
    await signupUser(request, { fullName: 'Titular Reînnoire Sesiune', email, password });
    await setUserRole(email, 'PRESEDINTE');
    const mfaCode = await prepareAdminMfa(email);
    await page.goto('/auth/signin');
    await page.getByLabel('Utilizator').fill(email);
    await page.getByLabel('Parolă', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Autentificare ca admin' }).click();
    await page.getByLabel('Cod din aplicația de autentificare', { exact: true }).fill(mfaCode!);
    const signinResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/signin') && response.status() === 200);
    await page.getByRole('button', { name: 'Autentificare ca admin' }).click();
    const signed = (await (await signinResponse).json()).data;
    await expect(page.getByRole('heading', { name: 'Administrare', exact: true })).toBeVisible();
    const claims = await verifyAuthToken(signed.token);
    expect(claims?.adminSessionId).toBeTruthy();
    // Only the disposable test account receives an expired, signed access token.
    const expiredToken = await createAuthToken({ ...signed.user, adminSessionId: claims!.adminSessionId, expiresInSeconds: -1 });
    let expiredRequests = 0;
    let refreshRequests = 0;
    const gate = new Promise<void>(resolve => { releaseRefresh = resolve; });
    await page.route('**/api/admin/**', async route => {
      const headers = route.request().headers();
      if (headers.authorization === `Bearer ${signed.token}`) {
        expiredRequests++;
        await route.continue({ headers: { ...headers, authorization: `Bearer ${expiredToken}` } });
      } else await route.continue();
    });
    await page.route('**/api/auth/refresh', async route => {
      refreshRequests++;
      await gate;
      await route.continue();
    });
    await page.getByRole('button', { name: 'Actualizează sarcinile' }).click();
    await expect.poll(() => refreshRequests).toBe(1);
    await page.getByRole('navigation', { name: 'Meniu administrativ' }).getByRole('link', { name: /^Membri/ }).click();
    await expect.poll(() => expiredRequests).toBeGreaterThanOrEqual(2);
    const renewedRead = page.waitForResponse(response => response.url().includes('/api/admin/members/dashboard') && response.status() === 200);
    releaseRefresh();
    await renewedRead;
    await expect(page).toHaveURL(/\/admin\/members$/);
    await expect(page.getByRole('heading', { name: 'Acces administrativ indisponibil' })).toHaveCount(0);
    expect(refreshRequests).toBe(1);
    // Expiration of the absolute MFA session still requires a fresh login.
    await query("UPDATE admin_auth_sessions SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=(SELECT id FROM users WHERE email=$1)", [email]);
    await page.getByRole('button', { name: 'Actualizează sarcinile' }).click();
    await expect(page).toHaveURL(/\/auth\/signin$/);
    await expect(page.getByLabel('Parolă', { exact: true })).toBeVisible();
    expect(refreshRequests).toBe(2);
  } finally {
    releaseRefresh();
    await deleteMembershipByEmail(email);
    await deleteUserByEmail(email);
  }
});
