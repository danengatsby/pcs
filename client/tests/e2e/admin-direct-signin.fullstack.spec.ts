import { expect, test } from "@playwright/test";
import { signOutThroughUi, signupUser } from "./helpers/auth";
import { buildTestEmail, deleteMembershipByEmail, deleteUserByEmail, prepareAdminMfa, query, setUserRole } from "./helpers/testDb";

test("administrative login requires personal credentials and MFA, survives reload and signs out", async ({ page, request }) => {
  const email = buildTestEmail('individual-admin');
  const password = 'ParolaFoarteBuna#2026';
  const requests: string[] = [];
  page.on('request', (req) => { if (req.url().endsWith('/api/auth/signin')) requests.push(req.url()); });
  try {
    await signupUser(request, { fullName: "Administrator nominal test", email, password });
    await setUserRole(email, "PRESEDINTE");
    const mfaCode = await prepareAdminMfa(email);
    expect(mfaCode).toBeTruthy();
    await page.goto("/auth/signin");
    await page.getByRole("button", { name: "Autentificare ca admin" }).click();
    await expect(page.getByRole('alert')).toContainText('Completează utilizatorul și parola contului personal.');
    expect(requests).toHaveLength(0);
    await page.getByLabel('Utilizator').fill(email);
    await page.getByLabel('Parolă', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Autentificare ca admin' }).click();
    await expect(page).toHaveURL(/\/auth\/signin$/);
    await page.getByLabel('Cod din aplicația de autentificare', { exact: true }).fill(mfaCode!);
    await page.getByRole('button', { name: 'Autentificare ca admin' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("navigation", { name: "Meniu administrativ" })).toBeVisible();
    await expect(page.getByText("Administrator nominal test", { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Meniu administrativ" })).toBeVisible();
    await page.goto("/auth/signin");
    await expect(page).toHaveURL(/\/admin$/);
    await signOutThroughUi(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth\/signin$/);
    const sessions = await query('SELECT id FROM admin_auth_sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)', [email]);
    expect(sessions.rowCount).toBe(0);
    await page.getByLabel("Utilizator").fill("alt-cont");
    await page.getByLabel("Parolă", { exact: true }).fill("alta-parola");
    await page.getByRole("button", { name: "Autentificare ca admin" }).click();
    await expect(page.getByRole('alert')).toContainText('Utilizatorul sau parola sunt invalide.');
    await expect(page).toHaveURL(/\/auth\/signin$/);
  } finally {
    await deleteMembershipByEmail(email);
    await deleteUserByEmail(email);
  }
});
