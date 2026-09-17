import { expect, test } from '@playwright/test';
import { signOutThroughUi } from './helpers/auth';
import { deleteUserByEmail, query } from './helpers/testDb';

test('two anonymous visitors enter administration on the first click without credentials or a personal link', async ({ browser, baseURL }) => {
  test.skip(process.env.AUTH_PUBLIC_ADMIN_ENABLED !== 'true', 'Requires explicitly enabled public administration');
  const visitors = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })]);
  try {
    const pages = await Promise.all(visitors.map(context => context.newPage()));
    await Promise.all(pages.map(async page => {
      let entries = 0;
      page.on('request', request => { if (request.url().endsWith('/api/auth/admin-public-login')) entries++; });
      await page.goto('/auth/signin');
      await page.getByRole('button', { name: 'Intră direct ca administrator', exact: true }).click();
      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.getByRole('heading', { name: 'Administrare', exact: true })).toBeVisible();
      await expect(page.getByText('Administrator public PCS', { exact: true }).first()).toBeVisible();
      expect(entries).toBe(1);
      await expect(page.getByLabel('Link personal de acces')).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole('navigation', { name: 'Meniu administrativ' })).toBeVisible();
    }));
    const tab = await visitors[0].newPage();
    await tab.goto('/auth/signin');
    await expect(tab).toHaveURL(/\/admin$/);
    await signOutThroughUi(pages[0]);
    await expect(tab).toHaveURL(/\/auth\/signin$/);
    // Logging out a visitor does not disconnect someone else's browser.
    await pages[1].reload();
    await expect(pages[1].getByRole('heading', { name: 'Administrare', exact: true })).toBeVisible();
    await pages[0].getByRole('button', { name: 'Intră direct ca administrator', exact: true }).click();
    await expect(pages[0]).toHaveURL(/\/admin$/);
  } finally {
    await Promise.all(visitors.map(context => context.close()));
    await query("DELETE FROM admin_audit_log WHERE target_type='user' AND target_id=(SELECT id::text FROM users WHERE email=$1)", ['administrator-public@pcs.invalid']);
    await deleteUserByEmail('administrator-public@pcs.invalid');
  }
});
