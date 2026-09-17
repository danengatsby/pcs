import { expect, test } from '@playwright/test';
import { Secret, TOTP } from 'otpauth';
import { issueAdminActivation } from '../../../server/src/lib/adminActivation';
import { buildTestEmail, deleteUserByEmail, query, setUserRole } from './helpers/testDb';
import { signupUser } from './helpers/auth';

// Pools are shared by files in the Playwright worker and allow exit on idle.
// Each test removes its own fixtures; a file must not close another test's pool.

test('personal link activates the account in the browser and enters the admin workspace', async ({ page, request }) => {
  const email = buildTestEmail('activation-browser');
  await signupUser(request, { email, fullName: 'Titular Activare Browser', password: 'ParolaVeche#2026' });
  await setUserRole(email, 'PRESEDINTE');
  let activationUrl = '';
  await issueAdminActivation({ email, operator: 'operator@example.test', reason: 'Activare nominală verificată în browser pe baza de test', deliver: async invitation => { activationUrl = invitation.url; } });
  const link = new URL(activationUrl);
  const token = link.hash.slice(1);
  const requestedUrls: string[] = [];
  page.on('request', outgoing => requestedUrls.push(outgoing.url()));
  try {
    const previewResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/admin-activation/preview'));
    await page.goto(link.pathname + link.hash);
    const preview = await (await previewResponse).json();
    await expect(page.getByRole('heading', { name: 'Activează contul tău' })).toBeVisible();
    await expect(page.getByAltText('Cod QR pentru configurarea autentificării PCS')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
    expect(requestedUrls.every(url => !url.includes(token))).toBeTruthy();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.getByLabel('1. Alege parola', { exact: true }).fill('ParolaPersonala#2026');
    await page.getByLabel('3. Introdu codul de 6 cifre', { exact: true }).fill(new TOTP({ secret: Secret.fromBase32(preview.data.secret) }).generate());
    await page.getByRole('button', { name: 'Activează și intră în cont' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Administrare', exact: true })).toBeVisible();
    const stored = await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage }));
    expect(stored.includes(token)).toBeFalsy();
    expect(stored.includes(preview.data.secret)).toBeFalsy();
    expect(stored.includes('ParolaPersonala#2026')).toBeFalsy();
    await page.goto(link.pathname + link.hash);
    await expect(page.getByRole('alert')).toContainText('Linkul de activare este invalid');
    await expect(page.getByAltText('Cod QR pentru configurarea autentificării PCS')).toHaveCount(0);
  } finally {
    await query("DELETE FROM admin_audit_log WHERE target_type='user' AND target_id=(SELECT id::text FROM users WHERE email=$1)", [email]);
    await deleteUserByEmail(email);
  }
});
