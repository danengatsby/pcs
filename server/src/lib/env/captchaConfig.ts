export type CaptchaMode = "required" | "optional" | "disabled";

export function readCaptchaMode(nodeEnv: string): CaptchaMode {
  const raw = process.env.CAPTCHA_MODE?.trim().toLowerCase() ?? "";

  if (!raw) {
    return nodeEnv === "production" ? "required" : "optional";
  }

  if (raw !== "required" && raw !== "optional" && raw !== "disabled") {
    throw new Error(`CAPTCHA_MODE invalid: ${raw}. Valorile permise sunt required|optional|disabled.`);
  }

  if (nodeEnv === "production" && raw !== "required") {
    throw new Error("In productie, CAPTCHA_MODE trebuie sa fie required.");
  }

  return raw;
}

export function readCaptchaSecret(captchaMode: CaptchaMode): string {
  const raw = process.env.CAPTCHA_SECRET_KEY?.trim() ?? "";
  if (raw) {
    return raw;
  }

  if (captchaMode === "disabled" || captchaMode === "optional") {
    return "";
  }

  throw new Error(
    "CAPTCHA_SECRET_KEY lipseste. Configureaza cheia captcha in server/.env cand CAPTCHA_MODE este required."
  );
}

export function readCaptchaVerifyUrl(): string {
  return (
    process.env.CAPTCHA_VERIFY_URL?.trim() ??
    "https://challenges.cloudflare.com/turnstile/v0/siteverify"
  );
}

export function readCaptchaExpectedAction(): string {
  return process.env.CAPTCHA_EXPECTED_ACTION?.trim() ?? "volunteer_signup";
}

export function readCaptchaExpectedHostname(publicBaseUrl: string): string {
  const raw = process.env.CAPTCHA_EXPECTED_HOSTNAME?.trim();
  if (raw) {
    return raw.toLowerCase();
  }

  if (!publicBaseUrl) {
    return "";
  }

  try {
    return new URL(publicBaseUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function readCaptchaMinScore(): number | null {
  const raw = process.env.CAPTCHA_MIN_SCORE?.trim();
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`CAPTCHA_MIN_SCORE invalid: ${raw}`);
  }

  return parsed;
}
