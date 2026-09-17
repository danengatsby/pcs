import { expect, test } from '@playwright/test';
import { signupUser, signInThroughUi } from './helpers/auth';
import { buildTestEmail, deleteUserByEmail, setUserRole } from './helpers/testDb';

test('fictional members are available on the same site through a separate read-only registry', async ({ page, request }) => {
  test.skip(!process.env.ADMIN_DEMO_DATABASE_URL, 'Requires a separately seeded demo test database.');
  const email = buildTestEmail('demo-view');
  const password = 'ParolaPersonala#2026';
  try {
    await signupUser(request, { fullName: 'Titular Demonstrație', email, password });
    await setUserRole(email, 'PRESEDINTE');
    await signInThroughUi(page, { email, password });
    await page.getByRole('link', { name: 'Zona administrativă', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Administrare', exact: true })).toBeVisible();
    await page.getByRole('navigation', { name: 'Meniu administrativ' }).getByRole('link', { name: /^Membri/ }).click();
    // Opening Members without an explicit dataset reveals the seeded examples.
    await expect(page).toHaveURL(/\/admin\/members\?dataset=demo$/);
    await expect(page.getByRole('status')).toContainText('Membri fictivi — demonstrație.');
    await expect(page.getByText('1–25 din 60', { exact: true })).toBeVisible();
    await expect(page.locator('.admin-members__record')).toHaveCount(25);
    await expect(page.getByText('Statistici membri fictivi', { exact: true }).locator('..')).not.toHaveAttribute('open');
    await expect(page.getByRole('button', { name: 'Suspendă', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Pagina următoare' }).click();
    await expect(page.getByText('26–50 din 60', { exact: true })).toBeVisible();
    await page.getByLabel('Caută nume, email, județ sau organizație').fill('membru.001@admin-demo.example.test');
    await expect(page.locator('.admin-members__record')).toHaveCount(1);
    await expect(page.getByText('1–1 din 1', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('status')).toContainText('Membri fictivi — demonstrație.');
    await expect(page.getByText('1–25 din 60', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Membri reali', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/members\?dataset=real$/);
    await expect(page.locator('.admin-members__record').filter({ hasText: '@admin-demo.example.test' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Vezi membrii fictivi' })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/admin\/members\?dataset=real$/);
    await page.getByRole('button', { name: 'Vezi membrii fictivi' }).click();
    await expect(page.getByText('1–25 din 60', { exact: true })).toBeVisible();
  } finally { await deleteUserByEmail(email); }
});
