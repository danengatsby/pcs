import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { prepareAdminMfa } from "./testDb";

export async function signupUser(
  request: APIRequestContext,
  input: { fullName: string; email: string; password: string },
): Promise<void> {
  const response = await request.post("/api/auth/signup", {
    data: input,
  });

  expect(response.ok()).toBeTruthy();
}

export async function signInThroughUi(
  page: Page,
  input: { email: string; password: string },
): Promise<void> {
  const mfaCode = await prepareAdminMfa(input.email);
  await page.goto("/auth/signin");
  await page.getByLabel("Utilizator").fill(input.email);
  await page.getByLabel("Parolă").fill(input.password);
  await page.getByRole("button", { name: "Autentificare", exact: true }).click();
  if (mfaCode) {
    await page.getByLabel("Cod din aplicația de autentificare", { exact: true }).fill(mfaCode);
    await page.getByRole("button", { name: "Autentificare", exact: true }).click();
  }
}

export async function signOutThroughUi(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Deconectare" }).click();
}
