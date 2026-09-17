import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { signInThroughUi, signupUser } from "./helpers/auth";
import { buildTestEmail, deleteUserByEmail, query, setUserRole } from "./helpers/testDb";

const password = "ParolaPersonala#2026";
test("treasury supports draft editing, explicit confirmation, cancellation and named history on mobile", async ({ page, request }) => {
  const email = buildTestEmail("treasurer-ui");
  const description = `Cheltuială verificare ${randomUUID()}`;
  try {
    await signupUser(request, { email, password, fullName: "Trezorier nominal test" });
    await setUserRole(email, "PRESEDINTE");
    await query("INSERT INTO admin_access_profiles (user_id, profile, assigned_by, reason) SELECT id, 'treasury', 'operator@example.test', 'Desemnare test browser' FROM users WHERE email = $1", [email]);
    await signInThroughUi(page, { email, password });
    await expect(page).toHaveURL(/\/profil$/);
    await page.goto("/admin/treasury");
    await expect(page.getByRole("heading", { name: "Trezorerie", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Operațiune nouă" }).click();
    await expect(page.getByLabel("Organizație")).toBeEnabled();
    await page.getByLabel("Tipul operațiunii").selectOption("expense");
    await page.getByLabel("Sumă (RON)").fill("123.45");
    await page.getByLabel("Descriere", { exact: true }).fill(description);
    await page.getByLabel("Referință document justificativ").fill("FACT-2026-TEST");
    await page.getByRole("button", { name: "Salvează ciorna" }).click();
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: description }) });
    await expect(card.getByText("Ciornă", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Modifică", exact: true }).click();
    await page.getByLabel("Sumă (RON)").fill("120.10");
    await page.getByRole("button", { name: "Salvează ciorna" }).click();
    await expect(card).toContainText("120,10");
    await card.getByRole("button", { name: "Confirmă operațiunea" }).click();
    await page.getByRole("checkbox", { name: /Am verificat suma/ }).check();
    await page.getByRole("button", { name: "Confirmă înregistrarea" }).click();
    await expect(card.getByText("Confirmată", { exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "Modifică", exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await card.getByRole("button", { name: "Anulează cu motiv" }).click();
    await page.getByLabel("Motivul anulării").fill("Document de test introdus pentru verificare.");
    await page.getByRole("button", { name: "Confirmă anularea" }).click();
    await expect(card.getByText("Anulată", { exact: true })).toBeVisible();
    await card.getByText("Istoric și responsabilitate", { exact: true }).click();
    await expect(card.getByRole("list")).toContainText("Trezorier nominal test");
    await expect(card.getByRole("list")).toContainText("Ciornă modificată");
    await page.goto("/admin/parliamentary");
    await expect(page.getByRole("heading", { name: "Acces restricționat" })).toBeVisible();
  } finally {
    await query("DELETE FROM treasury_entries WHERE description = $1", [description]);
    await deleteUserByEmail(email);
  }
});

test("parliamentary work supports named assignment, deadlines, stage changes and history", async ({ page, request }) => {
  const email = buildTestEmail("parliament-ui");
  const title = `Inițiativă verificare ${randomUUID()}`;
  try {
    await signupUser(request, { email, password, fullName: "Responsabil parlamentar test" });
    await setUserRole(email, "PRESEDINTE");
    await query("INSERT INTO admin_access_profiles (user_id, profile, assigned_by, reason) SELECT id, 'parliamentary', 'operator@example.test', 'Desemnare test browser' FROM users WHERE email = $1", [email]);
    await signInThroughUi(page, { email, password });
    await expect(page).toHaveURL(/\/profil$/);
    await page.goto("/admin/parliamentary");
    await page.getByRole("button", { name: "Inițiativă nouă" }).click();
    await expect(page.getByRole("option", { name: "Responsabil parlamentar test" })).toBeAttached();
    await page.getByLabel("Titlu", { exact: true }).fill(title);
    await page.getByLabel("Descriere", { exact: true }).fill("Descrierea inițiativei pentru verificarea fluxului parlamentar.");
    await page.getByLabel("Referință oficială", { exact: true }).fill("PL-X-TEST-2026");
    await page.getByRole("combobox", { name: "Responsabil", exact: true }).selectOption({ label: "Responsabil parlamentar test" });
    await page.getByLabel("Termen", { exact: true }).fill("2025-01-01");
    await page.getByRole("button", { name: "Salvează inițiativa" }).click();
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
    await expect(card.getByText("Termen depășit", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Actualizează etapa" }).click();
    await page.getByLabel("Etapa următoare").selectOption("submitted");
    await page.getByLabel("Justificare și referință").fill("Depunere verificată în registrul oficial, document de test.");
    await page.getByRole("button", { name: "Confirmă schimbarea" }).click();
    await expect(card.getByText("Depusă", { exact: true })).toBeVisible();
    await page.reload();
    await expect(card.getByText("Depusă", { exact: true })).toBeVisible();
    await card.getByText("Istoric și responsabilitate", { exact: true }).click();
    await expect(card.getByRole("list")).toContainText("Responsabil parlamentar test");
    await expect(card.getByRole("list")).toContainText("Etapă actualizată");
    await page.goto("/admin/treasury");
    await expect(page.getByRole("heading", { name: "Acces restricționat" })).toBeVisible();
  } finally {
    await query("DELETE FROM parliamentary_items WHERE title = $1", [title]);
    await deleteUserByEmail(email);
  }
});
