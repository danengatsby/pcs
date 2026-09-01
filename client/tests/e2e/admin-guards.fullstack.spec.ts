import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signInThroughUi, signupUser } from "./helpers/auth";
import { buildTestEmail, deleteUserByEmail } from "./helpers/testDb";

test("anonymous users are redirected to signin when opening admin routes", async ({ page }) => {
  await page.goto("/admin/volunteers");
  await expect(page).toHaveURL(/\/auth\/signin$/);

  await page.goto("/admin/members");
  await expect(page).toHaveURL(/\/auth\/signin$/);
});

test("non-admin users are redirected to home when opening the volunteers admin route", async ({ page, request }) => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const password = "ParolaFoarteBuna#2026";
  const userEmail = buildTestEmail(`playwright.member.${token}`);
  const userName = `Aderent Playwright ${token}`;

  try {
    await signupUser(request, {
      fullName: userName,
      email: userEmail,
      password,
    });

    await signInThroughUi(page, {
      email: userEmail,
      password,
    });

    await expect(page).toHaveURL(/\/profil$/);
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

    await page.goto("/admin/volunteers");
    await expect(page).toHaveURL(/\/$/);
  } finally {
    await deleteUserByEmail(userEmail);
  }
});

test("non-admin users are redirected to home when opening the members admin route", async ({ page, request }) => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const password = "ParolaFoarteBuna#2026";
  const userEmail = buildTestEmail(`playwright.member.${token}`);
  const userName = `Aderent Playwright ${token}`;

  try {
    await signupUser(request, {
      fullName: userName,
      email: userEmail,
      password,
    });

    await signInThroughUi(page, {
      email: userEmail,
      password,
    });

    await expect(page).toHaveURL(/\/profil$/);
    await page.goto("/admin/members");
    await expect(page).toHaveURL(/\/$/);
  } finally {
    await deleteUserByEmail(userEmail);
  }
});
