import { chromium } from "@playwright/test";

const baseUrl = process.env.PCS_SMOKE_BASE_URL?.trim() || "http://127.0.0.1:4000";
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto(new URL("/", baseUrl).href, {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });

  if (!response?.ok()) {
    throw new Error(`Pagina publică a răspuns cu HTTP ${response?.status() ?? "necunoscut"}.`);
  }

  await page.getByRole("heading", { name: /Demnitate pentru seniori/i }).waitFor({
    state: "visible",
    timeout: 10_000,
  });

  const primaryCta = page.getByRole("link", { name: "Citește programul" });
  await primaryCta.waitFor({ state: "visible", timeout: 10_000 });

  const ctaHref = await primaryCta.getAttribute("href");
  if (ctaHref !== "/documente/program-politic") {
    throw new Error(`CTA-ul principal are href neașteptat: ${ctaHref ?? "absent"}.`);
  }

  if (pageErrors.length > 0) {
    throw new Error(`Erori JavaScript în pagina publică: ${pageErrors.join(" | ")}`);
  }

  console.log(`Synthetic frontend smoke passed: ${baseUrl}`);
} finally {
  await browser.close();
}
