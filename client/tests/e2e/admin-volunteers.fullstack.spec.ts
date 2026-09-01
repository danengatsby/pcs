import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signInThroughUi, signupUser } from "./helpers/auth";
import {
  buildTestEmail,
  deleteUserByEmail,
  deleteVolunteerByEmail,
  insertVolunteerWithoutUser,
  query,
  setUserRole,
} from "./helpers/testDb";

test("admin can update volunteer workflow from the volunteers screen", async ({ page, request }) => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const password = "ParolaFoarteBuna#2026";

  const adminEmail = buildTestEmail(`playwright.admin.${token}`);
  const volunteerEmail = buildTestEmail(`playwright.volunteer.${token}`);

  const adminName = `Admin Playwright ${token}`;
  const volunteerName = `Voluntar Playwright ${token}`;
  const updatedNotes = `Note actualizate Playwright ${token}`;

  try {
    await signupUser(request, {
      fullName: adminName,
      email: adminEmail,
      password,
    });

    await setUserRole(adminEmail, "PRESEDINTE");

    await insertVolunteerWithoutUser({
      fullName: volunteerName,
      email: volunteerEmail,
      county: "Cluj",
      locality: "Cluj-Napoca",
      workflowStatus: "nou",
      internalNotes: `Inițial ${token}`,
    });

    await signInThroughUi(page, {
      email: adminEmail,
      password,
    });

    await expect(page).toHaveURL(/\/profil$/);
    await page.goto("/admin/volunteers");
    await expect(page).toHaveURL(/\/admin\/volunteers$/);

    await page.getByLabel("Caută").fill(token);
    await expect(page.getByRole("button", { name: new RegExp(volunteerName) })).toBeVisible();
    await page.getByRole("button", { name: new RegExp(volunteerName) }).click();

    const detailsPanel = page.locator(".volunteer-admin__panel--details");
    await detailsPanel.getByRole("combobox", { name: "Status" }).selectOption("contactat");
    await detailsPanel.getByLabel("Note interne").fill(updatedNotes);

    const workflowResponse = page.waitForResponse((response) => (
      response.request().method() === "PATCH"
      && /\/api\/admin\/volunteers\/\d+\/workflow$/.test(response.url())
      && response.status() === 200
    ));

    await detailsPanel.getByRole("button", { name: "Salvează" }).click();
    await workflowResponse;

    await expect.poll(async () => {
      const result = await query<{ workflow_status: string; internal_notes: string }>(
        `
          SELECT workflow_status::text, internal_notes
          FROM volunteers
          WHERE LOWER(email) = LOWER($1)
        `,
        [volunteerEmail],
      );

      const row = result.rows[0];
      return row ? `${row.workflow_status}:${row.internal_notes}` : null;
    }).toBe(`contactat:${updatedNotes}`);
  } finally {
    await deleteVolunteerByEmail(volunteerEmail);
    await deleteUserByEmail(adminEmail);
  }
});
