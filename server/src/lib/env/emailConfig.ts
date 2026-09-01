import { isLikelyEmail, readBooleanFlag, readPositiveInt } from "./shared.js";

export function readEmailNotificationsEnabled(): boolean {
  return readBooleanFlag(process.env.EMAIL_NOTIFICATIONS_ENABLED, false);
}

export function readEmailFrom(enabled: boolean): string {
  const raw = process.env.EMAIL_FROM?.trim() ?? "no-reply@pcs.local";
  if (enabled && !isLikelyEmail(raw)) {
    throw new Error(`EMAIL_FROM invalid: ${raw}`);
  }
  return raw;
}

export function readEmailReplyTo(): string {
  return process.env.EMAIL_REPLY_TO?.trim() ?? "";
}

export function readEmailSmtpHost(enabled: boolean): string {
  const raw = process.env.EMAIL_SMTP_HOST?.trim() ?? "";
  if (enabled && !raw) {
    throw new Error("EMAIL_SMTP_HOST lipseste. Configureaza hostul SMTP in server/.env.");
  }
  return raw;
}

export function readEmailSmtpPort(): number {
  const raw = process.env.EMAIL_SMTP_PORT?.trim() ?? "587";
  return readPositiveInt(raw, "EMAIL_SMTP_PORT");
}

export function readEmailSmtpSecure(): boolean {
  return readBooleanFlag(process.env.EMAIL_SMTP_SECURE, false);
}

export function readEmailSmtpRequireStartTls(): boolean {
  return readBooleanFlag(process.env.EMAIL_SMTP_REQUIRE_STARTTLS, true);
}

export function readEmailSmtpUser(): string {
  return process.env.EMAIL_SMTP_USER?.trim() ?? "";
}

export function readEmailSmtpPass(): string {
  return process.env.EMAIL_SMTP_PASS ?? "";
}

export function readEmailSendTimeoutMs(): number {
  const raw = process.env.EMAIL_SEND_TIMEOUT_MS?.trim() ?? "12000";
  return readPositiveInt(raw, "EMAIL_SEND_TIMEOUT_MS");
}

export function readEmailNewsPublishRecipients(): string[] {
  const raw = process.env.EMAIL_NEWS_PUBLISH_RECIPIENTS?.trim() ?? "";
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .filter((value) => isLikelyEmail(value));
}

export function validateSmtpCredentials(user: string, pass: string): void {
  if ((user && !pass) || (!user && pass)) {
    throw new Error("EMAIL_SMTP_USER si EMAIL_SMTP_PASS trebuie setate impreuna.");
  }
}
