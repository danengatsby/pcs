import { expect, test } from "@playwright/test";
import { signOutThroughUi, signupUser } from "./helpers/auth";
import { deleteMembershipByEmail, deleteUserByEmail, setUserRole } from "./helpers/testDb";

test("admin button opens the configured account, survives reload and supports signout", async ({ page, request }) => {
  // Dedicated account configured only on the isolated Playwright server.
  const email = "public-admin@example.test";
  try {
    await signupUser(request, { fullName: "Administrator comun test", email, password: "ParolaFoarteBuna#2026" });
    await setUserRole(email, "PRESEDINTE");

    await page.goto("/auth/signin");
    await page.getByRole("button", { name: "Autentificare ca admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("navigation", { name: "Meniu administrativ" })).toBeVisible();
    await expect(page.getByText("Administrator comun test", { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Meniu administrativ" })).toBeVisible();
    await page.goto("/auth/signin");
    await expect(page).toHaveURL(/\/admin$/);

    await signOutThroughUi(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth\/signin$/);
    // Filled credentials do not change the destination account of the public button.
    await page.getByLabel("Utilizator").fill("alt-cont");
    await page.getByLabel("Parolă", { exact: true }).fill("alta-parola");
    await page.getByRole("button", { name: "Autentificare ca admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Administrator comun test", { exact: true }).first()).toBeVisible();
    await signOutThroughUi(page);
  } finally {
    await deleteMembershipByEmail(email);
    await deleteUserByEmail(email);
  }
});
