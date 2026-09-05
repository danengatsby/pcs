import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signupUser } from "./helpers/auth";
import { buildTestEmail, deleteUserByEmail, query, setUserRole } from "./helpers/testDb";

test.use({ actionTimeout: 10_000 });

test("territorial shell supports direct routes, live task badges, congress and arbitration creation on desktop and mobile", async ({ page, request }, testInfo) => {
  const suffix = randomUUID().slice(0, 8);
  const email = buildTestEmail(`shell-${suffix}`);
  const organizationId = `shell-${suffix}`;
  const password = "ParolaFoarteBuna#2026";
  let actorId = "";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await signupUser(request, { fullName: "Secretar interfață", email, password });
    await setUserRole(email, "SECRETAR");
    actorId = (await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email])).rows[0].id;
    await query("INSERT INTO organizations (id, code, name, level, county, status) VALUES ($1, $1, 'Filiala test shell', 'county', 'Cluj', 'active')", [organizationId]);
    await query("INSERT INTO organization_territories (organization_id, territory_type, county_id, locality) SELECT $1, 'county', id, '' FROM counties WHERE name = 'Cluj'", [organizationId]);
    await query("INSERT INTO organization_leadership_mandates (organization_id, user_id, full_name, position_title, started_at, status) VALUES ($1, $2, 'Secretar interfață', 'Secretar', CURRENT_DATE, 'active')", [organizationId, actorId]);

    await page.goto("/auth/signin");
    await page.getByLabel("Utilizator").fill(email);
    await page.getByLabel("Parolă", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Autentificare ca admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    const nav = page.getByRole("navigation", { name: "Meniu administrativ" });
    await expect(nav.getByRole("link")).toHaveCount(7);
    await expect(nav.getByRole("link", { name: /Tablou de comandă/ })).toHaveCount(0);

    await nav.getByRole("link", { name: /Congres/ }).click();
    await expect(page.getByRole("heading", { name: "Congres", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Congres nou" }).click();
    await page.getByLabel("Organizație", { exact: true }).selectOption(organizationId);
    await page.getByLabel("Titlu", { exact: true }).fill(`Congres ${suffix}`);
    await page.getByLabel("Deschidere", { exact: true }).fill("2026-10-01T10:00");
    await page.getByLabel("Închidere", { exact: true }).fill("2026-10-02T10:00");
    await page.getByLabel("Cvorum (delegați prezenți)").fill("20");
    await page.getByRole("button", { name: "Creează în pregătire" }).click();
    await expect(page.getByRole("heading", { name: `Congres ${suffix}` })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Congres/ }).getByLabel("1 sarcină restantă")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("admin-desktop.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Meniu administrativ" }).click();
    await nav.getByRole("link", { name: /Arbitraj/ }).click();
    await expect(page.getByRole("button", { name: "Meniu administrativ" })).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Dosar nou" }).click();
    await page.getByLabel("Organizație", { exact: true }).selectOption(organizationId);
    await page.getByLabel("Subiect", { exact: true }).fill(`Sesizare ${suffix}`);
    await page.getByLabel("Situația de fapt").fill("Descriere completă pentru dosarul de verificare a interfeței.");
    await page.getByRole("button", { name: "Înregistrează dosarul" }).click();
    await expect(page.getByRole("heading", { name: new RegExp(`Sesizare ${suffix}`) })).toBeVisible();
    await page.getByRole("button", { name: "Meniu administrativ" }).click();
    await expect(nav.getByRole("link", { name: /Arbitraj/ }).getByLabel("1 sarcină restantă")).toBeVisible();
    await page.getByRole("button", { name: "Meniu administrativ" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("admin-mobile.png"), fullPage: true });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Arbitraj", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Meniu administrativ" }).click();
    await expect(nav.getByRole("link", { name: /Arbitraj/ })).toHaveAttribute("aria-current", "page");
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "Acces restricționat" })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await query("DELETE FROM arbitration_cases WHERE organization_id = $1", [organizationId]);
    await query("DELETE FROM congresses WHERE organization_id = $1", [organizationId]);
    await query("DELETE FROM organizations WHERE id = $1", [organizationId]);
    await deleteUserByEmail(email);
  }
});
