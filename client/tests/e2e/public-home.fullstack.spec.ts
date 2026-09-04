import { expect, test } from "@playwright/test";

test("public homepage renders its headline and primary call to action", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: /Demnitate pentru seniori/i })).toBeVisible();

  const primaryCta = page.getByRole("link", { name: "Citește programul" });
  await expect(primaryCta).toBeVisible();
  await expect(primaryCta).toHaveAttribute("href", "/documente/program-politic");
  expect(pageErrors).toEqual([]);
});
