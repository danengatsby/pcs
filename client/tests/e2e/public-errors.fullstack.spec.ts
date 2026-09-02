import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signupUser } from "./helpers/auth";
import { fillVolunteerSignupForm } from "./helpers/contact";
import {
  buildTestEmail,
  deleteMembershipByEmail,
  deleteUserByEmail,
  deleteVolunteerByEmail,
  insertVolunteerWithoutUser,
  query,
} from "./helpers/testDb";

test("signin shows an error for invalid credentials", async ({ page, request }) => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const email = buildTestEmail(`playwright.invalid-login.${token}`);
  const password = "ParolaFoarteBuna#2026";
  const fullName = `Login Invalid ${token}`;

  try {
    await signupUser(request, {
      fullName,
      email,
      password,
    });

    await page.goto("/auth/signin");
    await page.getByLabel("Utilizator").fill(email);
    await page.getByLabel("Parolă").fill("ParolaGresita#2026");

    const signinResponse = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && response.url().endsWith("/api/auth/signin")
      && response.status() === 401
    ));

    await page.getByRole("button", { name: "Autentificare", exact: true }).click();
    await signinResponse;

    await expect(page).toHaveURL(/\/auth\/signin$/);
    await expect(page.getByText("Utilizatorul sau parola sunt invalide.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Deconectare" })).toHaveCount(0);
  } finally {
    await deleteUserByEmail(email);
  }
});

test("volunteer signup shows a friendly error when the email already exists", async ({ page }) => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const email = buildTestEmail(`playwright.duplicate-volunteer.${token}`);
  const fullName = `Voluntar Duplicat ${token}`;
  const password = "ParolaFoarteBuna#2026";
  const phone = "0712345678";
  const locality = "Cluj-Napoca";
  const skills = "organizare comunitara";
  const motivation = "Vreau sa ma implic activ in proiectele locale.";

  try {
    await insertVolunteerWithoutUser({
      fullName,
      email,
      county: "Cluj",
      locality,
      workflowStatus: "nou",
      internalNotes: `Duplicat ${token}`,
    });

    await page.goto("/contact");
    await fillVolunteerSignupForm(page, {
      fullName,
      email,
      password,
      phone,
      county: "Cluj",
      locality,
      skills,
      motivation,
    });

    const signupResponse = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && response.url().endsWith("/api/volunteers")
      && response.status() === 409
    ));

    await page.getByRole("button", { name: "Trimite cererea" }).click();
    await signupResponse;

    await expect(page.getByText("Există deja o cerere/înscriere cu acest email.")).toBeVisible();
    await expect(page.locator(".join-form__identity-summary")).toContainText(email);

    await expect.poll(async () => {
      const result = await query<{ volunteer_count: number; user_count: number }>(
        `
          SELECT
            (SELECT COUNT(*)::int FROM volunteers WHERE LOWER(email) = LOWER($1)) AS volunteer_count,
            (SELECT COUNT(*)::int FROM users WHERE LOWER(email) = LOWER($1)) AS user_count
        `,
        [email],
      );

      const row = result.rows[0];
      return row ? `${row.volunteer_count}|${row.user_count}` : null;
    }).toBe("1|0");
  } finally {
    await deleteMembershipByEmail(email);
    await deleteVolunteerByEmail(email);
    await deleteUserByEmail(email);
  }
});
