import { expect, type Page } from "@playwright/test";

export type VolunteerSignupFormInput = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  county: string;
  locality: string;
  skills: string;
  motivation: string;
};

export async function fillVolunteerSignupForm(
  page: Page,
  input: VolunteerSignupFormInput,
): Promise<void> {
  await page.getByLabel("Nume complet").fill(input.fullName);
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Telefon (opțional)").fill(input.phone);
  await page.getByRole("combobox", { name: /^Județ/ }).selectOption(input.county);
  await page.getByLabel("Localitate").fill(input.locality);

  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByLabel("Parolă pentru cont").fill(input.password);
  await page.getByLabel("Competențe (opțional)").fill(input.skills);
  await page.getByLabel("De ce vrei să te implici?").fill(input.motivation);
  await page.getByRole("checkbox").check();

  await expect(page.locator('[name="cf-turnstile-response"]').first()).toHaveValue(/\S+/, {
    timeout: 20_000,
  });
}
