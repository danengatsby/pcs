import { expect, test } from "@playwright/test";

test("documents menu loads on demand and opens a document page", async ({ page }) => {
  await page.goto("/");

  const documentsButton = page.getByRole("button", { name: "Documente" });
  await documentsButton.hover();
  await documentsButton.click();
  await expect(page.getByRole("menuitem", { name: "Statut" })).toBeVisible();

  await page.getByRole("menuitem", { name: "Statut" }).click();

  await expect(page).toHaveURL(/\/documente\/statut$/);
  await expect(page.getByRole("heading", { name: "Statut PCS" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Deschide separat" })).toBeVisible();
  await expect(page.locator('iframe[title="Statut PCS"]')).toBeVisible();
});
