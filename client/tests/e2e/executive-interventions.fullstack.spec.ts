import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signupUser, signInThroughUi } from "./helpers/auth";
import { buildTestEmail, deleteUserByEmail, insertMembershipByEmail, query, setUserRole } from "./helpers/testDb";

test.use({ actionTimeout: 10_000 });

test("presidential dashboard starts with six intervention queues and resolves events and expiration metadata", async ({ page, request }, testInfo) => {
  const key = `president-${randomUUID().slice(0, 8)}`;
  const email = buildTestEmail(key);
  const applicantEmail = `${key}-applicant@example.test`;
  const password = "ParolaFoarteBuna#2026";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await signupUser(request, { email, fullName: `Președinte ${key}`, password });
    await setUserRole(email, "PRESEDINTE");
    await insertMembershipByEmail(email, "active");
    const actor = (await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email])).rows[0];
    await query("INSERT INTO organizations (id, code, name, level, status) VALUES ($1, $1, $2, 'county', 'active')", [key, `Filiala ${key}`]);
    await query("INSERT INTO volunteers (full_name, email, phone, county, locality, skills, motivation, created_at) VALUES ($1, $2, '', 'Cluj', 'Cluj-Napoca', '', '', NOW() - INTERVAL '3 days')", [`Cerere ${key}`, applicantEmail]);
    const objective = (await query<{ id: string }>("INSERT INTO organization_objectives (organization_id, title, target_value, due_date) VALUES ($1, $2, 10, CURRENT_DATE - 1) RETURNING id", [key, `Obiectiv ${key}`])).rows[0];
    const event = (await query<{ id: string }>("INSERT INTO mobilization_actions (slug, action_type, title, summary, organization_id, starts_at) VALUES ($1, 'event', $2, 'Eveniment de coordonat', $1, NOW() + INTERVAL '1 day') RETURNING id", [key, `Eveniment ${key}`])).rows[0];
    const task = (await query<{ id: string }>("INSERT INTO mobilization_actions (slug, action_type, title, summary, organization_id) VALUES ($1, 'volunteer_task', $2, 'Sarcină de verificat', $3) RETURNING id", [`${key}-task`, `Raport ${key}`, key])).rows[0];
    const participant = (await query<{ id: string }>("INSERT INTO mobilization_participants (action_id, full_name, email, status, reported_at, report, hours) VALUES ($1, 'Autor raport', $2, 'reported', NOW() - INTERVAL '3 days', 'Activitatea a fost realizată și așteaptă validare.', 3) RETURNING id", [task.id, applicantEmail])).rows[0];
    await query("INSERT INTO member_documents (title, category, path, expires_on) VALUES ($1, 'statutar', $2, CURRENT_DATE - 1)", [`Document ${key}`, `/${key}.pdf`]);

    await signInThroughUi(page, { email, password });
    await expect(page).toHaveURL(/\/profil$/);
    await page.goto('/admin/dashboard');
    const agenda = page.getByRole('region', { name: 'Intervenții necesare' });
    await expect(agenda.getByRole('heading', { name: `Eveniment ${key}`, exact: true })).toBeVisible();
    for (const title of [`Cerere ${key}`, `Filiala ${key}`, `Obiectiv ${key}`, `Document ${key}`]) {
      await expect(agenda.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
    await expect(agenda.getByRole('heading', { name: `Autor raport · Raport ${key}` })).toBeVisible();
    expect(await page.evaluate(() => {
      const interventions = document.querySelector('.executive-interventions')!;
      const stats = document.querySelector('[aria-label="Indicatori executivi"]')!;
      return !!(interventions.compareDocumentPosition(stats) & Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('interventions-desktop.png') });

    await agenda.locator('li').filter({ has: page.getByRole('heading', { name: `Filiala ${key}`, exact: true }) }).getByRole('link', { name: 'Deschide înregistrarea' }).click();
    await expect(page.locator(`[id="organization-${key}"]`)).toBeFocused();
    await page.goto('/admin/dashboard');
    await agenda.locator('li').filter({ has: page.getByRole('heading', { name: `Obiectiv ${key}`, exact: true }) }).getByRole('link', { name: 'Deschide înregistrarea' }).click();
    await expect(page.locator(`[id="objective-${objective.id}"]`)).toBeFocused();
    await expect(page.locator(`[id="objective-${objective.id}"]`)).toBeInViewport();

    await page.goto('/admin/dashboard');
    await agenda.locator('li').filter({ has: page.getByRole('heading', { name: `Autor raport · Raport ${key}`, exact: true }) }).getByRole('link', { name: 'Deschide înregistrarea' }).click();
    const report = page.locator(`[id="participant-${participant.id}"]`);
    await expect(report).toBeFocused();
    await expect(report.getByText('Raport: Activitatea a fost realizată și așteaptă validare.')).toBeVisible();
    await report.getByRole('button', { name: 'Validează raportul' }).click();
    await expect(report.getByText('completed · 3 ore', { exact: true })).toBeVisible();
    await page.goto('/admin/dashboard');
    await expect(agenda.getByRole('heading', { name: `Autor raport · Raport ${key}` })).toHaveCount(0);

    await agenda.locator('li').filter({ has: page.getByRole('heading', { name: `Eveniment ${key}`, exact: true }) }).getByRole('link', { name: 'Deschide înregistrarea' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/mobilization\\?action=${event.id}$`));
    await expect(page.locator(`[id="action-${event.id}"]`)).toBeFocused();
    await page.getByRole('combobox', { name: `Coordonator pentru Eveniment ${key}` }).selectOption(actor.id);
    await page.getByRole('button', { name: 'Salvează coordonatorul' }).click();
    await expect(page.getByText(`Coordonator: Președinte ${key}`, { exact: false })).toBeVisible();

    await page.goto('/admin/dashboard');
    await expect(agenda.getByRole('heading', { name: `Document ${key}`, exact: true })).toBeVisible();
    await expect(agenda.getByRole('heading', { name: `Eveniment ${key}`, exact: true })).toHaveCount(0);
    await agenda.locator('li').filter({ has: page.getByRole('heading', { name: `Document ${key}`, exact: true }) }).getByRole('link', { name: 'Deschide înregistrarea' }).click();
    await expect(page.getByRole('region', { name: 'Termenele deciziilor și documentelor' })).toBeFocused();
    const date = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    await page.getByLabel(`Data expirării pentru Document ${key}`, { exact: true }).fill(date);
    await page.getByRole('button', { name: 'Salvează termenul' }).click();
    await expect(agenda.getByRole('heading', { name: `Document ${key}`, exact: true })).toHaveCount(0);
    const updated = await query<{ expires_on: Date }>("SELECT expires_on FROM member_documents WHERE path = $1", [`/${key}.pdf`]);
    expect(updated.rows[0].expires_on.toISOString().slice(0, 10)).toBe(date);

    await page.goto('/admin/dashboard');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(agenda.getByRole('heading', { name: `Cerere ${key}` })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('interventions-mobile.png') });
    expect(errors).toEqual([]);
  } finally {
    await query("DELETE FROM mobilization_actions WHERE organization_id = $1", [key]);
    await query("DELETE FROM member_documents WHERE path = $1", [`/${key}.pdf`]);
    await query("DELETE FROM volunteers WHERE email = $1", [applicantEmail]);
    await query("DELETE FROM membership_records WHERE email = $1", [email]);
    await query("DELETE FROM organizations WHERE id = $1", [key]);
    await deleteUserByEmail(email);
  }
});
