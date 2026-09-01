import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signInThroughUi, signupUser } from "./helpers/auth";
import {
  buildTestEmail,
  deleteUserByEmail,
  deleteVolunteerByEmail,
  insertVolunteerWithoutUser,
  setUserRole,
} from "./helpers/testDb";

test("admin can browse the members dashboard with filtered results", async ({ page, request }) => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const password = "ParolaFoarteBuna#2026";

  const adminEmail = buildTestEmail(`playwright.admin.${token}`);
  const memberEmail = buildTestEmail(`playwright.member.${token}`);
  const volunteerEmail = buildTestEmail(`playwright.volunteer.${token}`);

  const adminName = `Admin Playwright ${token}`;
  const memberName = `Membru Playwright ${token}`;
  const volunteerName = `Voluntar Playwright ${token}`;

  try {
    await signupUser(request, {
      fullName: adminName,
      email: adminEmail,
      password,
    });
    await signupUser(request, {
      fullName: memberName,
      email: memberEmail,
      password,
    });

    await setUserRole(adminEmail, "PRESEDINTE");
    await setUserRole(memberEmail, "MEMBRU");

    await insertVolunteerWithoutUser({
      fullName: volunteerName,
      email: volunteerEmail,
      county: "Cluj",
      locality: "Cluj-Napoca",
      workflowStatus: "validat",
      internalNotes: `Inițial ${token}`,
    });

    await signInThroughUi(page, {
      email: adminEmail,
      password,
    });

    await expect(page).toHaveURL(/\/profil$/);

    await page.goto("/admin/members");
    await expect(page).toHaveURL(/\/admin\/members$/);

    await page.getByLabel("Caută după nume sau email").fill(token);
    await expect(page.getByText(new RegExp(`Filtru activ: “${escapeRegex(token)}”\\.`))).toBeVisible();

    await expect(page.getByRole("heading", { name: adminName })).toBeVisible();
    await expect(page.getByRole("heading", { name: memberName })).toBeVisible();
    await expect(page.getByRole("heading", { name: volunteerName })).toBeVisible();
  } finally {
    await deleteVolunteerByEmail(volunteerEmail);
    await deleteUserByEmail(memberEmail);
    await deleteUserByEmail(adminEmail);
  }
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
