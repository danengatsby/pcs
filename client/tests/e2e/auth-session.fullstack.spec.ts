import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signInThroughUi, signOutThroughUi, signupUser } from "./helpers/auth";
import { buildTestEmail, deleteUserByEmail } from "./helpers/testDb";

test("user session is restored after reload and cleared on signout", async ({ page, request }) => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const email = buildTestEmail(`playwright.auth.${token}`);
  const password = "ParolaFoarteBuna#2026";
  const fullName = `Utilizator Public ${token}`;

  try {
    await signupUser(request, {
      fullName,
      email,
      password,
    });

    await signInThroughUi(page, {
      email,
      password,
    });

    await expect(page).toHaveURL(/\/profil$/);
    await expect(page.getByRole("button", { name: "Deconectare" })).toBeVisible();

    const refreshResponse = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && response.url().endsWith("/api/auth/refresh")
      && response.status() === 200
    ));

    await page.reload();
    await refreshResponse;

    await expect(page.getByRole("button", { name: "Deconectare" })).toBeVisible();

    const signoutResponse = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && response.url().endsWith("/api/auth/signout")
      && response.status() === 200
    ));

    await signOutThroughUi(page);
    await signoutResponse;

    await expect(page).toHaveURL(/\/auth\/signin$/);
    await expect(page.getByRole("heading", { name: "Autentificare" })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/auth\/signin$/);
    await expect(page.getByRole("button", { name: "Autentificare", exact: true })).toBeVisible();
  } finally {
    await deleteUserByEmail(email);
  }
});
