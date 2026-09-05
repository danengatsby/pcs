import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { fillVolunteerSignupForm } from "./helpers/contact";
import {
  buildTestEmail,
  deleteMembershipByEmail,
  deleteUserByEmail,
  deleteVolunteerByEmail,
  query,
} from "./helpers/testDb";

test("visitor can submit the volunteer signup form without Cloudflare and create account records", async ({ page }) => {
  const externalRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on("request", (request) => {
    if (/cloudflare\.com|turnstile/i.test(request.url())) externalRequests.push(request.url());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route(/cloudflare\.com|turnstile/i, (route) => route.abort());
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const email = buildTestEmail(`playwright.join.${token}`);
  const fullName = `Aderent Public ${token}`;
  const password = "ParolaFoarteBuna#2026";
  const phone = "0712345678";
  const locality = "Cluj-Napoca";
  const skills = "organizare comunitara";
  const motivation = "Vreau sa ma implic activ in proiectele locale.";

  try {
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

    const submitResponse = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && response.url().endsWith("/api/volunteers")
    ));

    await page.getByRole("button", { name: "Trimite cererea" }).click();
    const response = await submitResponse;
    const requestPayload = response.request().postDataJSON();
    expect(requestPayload).not.toHaveProperty("captchaToken");
    expect(requestPayload.website).toBe("");
    expect(response.status(), await response.text()).toBe(201);

    await expect(page.getByText("Cererea de înscriere a fost trimisă. Mulțumim!")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mulțumim pentru înscriere." })).toBeVisible();
    await expect(page.getByLabel("Nume complet")).toHaveCount(0);

    await expect.poll(async () => {
      const result = await query<{
        volunteer_id: number;
        volunteer_status: string;
        volunteer_county: string;
        volunteer_locality: string;
        user_role: string;
      }>(
        `
          SELECT
            v.id AS volunteer_id,
            v.workflow_status::text AS volunteer_status,
            v.county AS volunteer_county,
            v.locality AS volunteer_locality,
            u.role::text AS user_role
          FROM volunteers v
          INNER JOIN users u
            ON LOWER(u.email) = LOWER(v.email)
          WHERE LOWER(v.email) = LOWER($1)
        `,
        [email],
      );

      const row = result.rows[0];
      return row
        ? `${row.volunteer_status}|${row.volunteer_county}|${row.volunteer_locality}|${row.user_role}`
        : null;
    }).toBe(`nou|Cluj|${locality}|SUSTINATOR`);
    expect(externalRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    await deleteMembershipByEmail(email);
    await deleteVolunteerByEmail(email);
    await deleteUserByEmail(email);
  }
});
