import type { NotificationEmailPayload } from "./notificationOutbox.types.js";

export const defaultBatchSize = 50;
export const defaultMaxAttempts = 6;
export const defaultBaseDelaySeconds = 30;
export const defaultMaxDelaySeconds = 3600;

const actionMaxLength = 120;
const errorMaxLength = 1200;

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeAction(rawAction: string): string {
  const normalized = rawAction.trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  return normalized.slice(0, actionMaxLength);
}

function normalizeRecipientList(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const normalized = raw.trim().toLowerCase();
    if (!normalized || !isLikelyEmail(normalized) || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function normalizePayload(rawPayload: NotificationEmailPayload): NotificationEmailPayload | null {
  const recipients = normalizeRecipientList(rawPayload.to);
  if (recipients.length === 0) {
    return null;
  }

  const subject = rawPayload.subject.trim();
  const text = rawPayload.text.trim();
  if (!subject || !text) {
    return null;
  }

  const replyTo = (rawPayload.replyTo ?? "").trim();
  return {
    to: recipients,
    subject,
    text,
    replyTo: replyTo || undefined,
  };
}

export function parsePayload(rawPayload: unknown): NotificationEmailPayload | null {
  if (!rawPayload || typeof rawPayload !== "object") {
    return null;
  }

  const payloadRecord = rawPayload as Record<string, unknown>;
  const to = Array.isArray(payloadRecord.to) ? payloadRecord.to : [];
  const recipients = to.filter((value): value is string => typeof value === "string");
  const subject = typeof payloadRecord.subject === "string" ? payloadRecord.subject : "";
  const text = typeof payloadRecord.text === "string" ? payloadRecord.text : "";
  const replyTo = typeof payloadRecord.replyTo === "string" ? payloadRecord.replyTo : undefined;

  return normalizePayload({
    to: recipients,
    subject,
    text,
    replyTo,
  });
}

export function normalizePositiveInt(rawValue: unknown, fallback: number): number {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function clampDelaySeconds(value: number, maxDelaySeconds: number): number {
  return Math.max(1, Math.min(maxDelaySeconds, Math.floor(value)));
}

export function computeRetryDelaySeconds(
  attemptCount: number,
  baseDelaySeconds: number,
  maxDelaySeconds: number
): number {
  const exponent = Math.max(0, attemptCount - 1);
  const exponentialDelay = baseDelaySeconds * (2 ** exponent);
  return clampDelaySeconds(exponentialDelay, maxDelaySeconds);
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof AggregateError) {
    for (const item of error.errors) {
      if (item instanceof Error && item.message.trim()) {
        return item.message.trim().slice(0, errorMaxLength);
      }
    }
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message.slice(0, errorMaxLength);
    }

    const errorCode = Reflect.get(error as object, "code");
    if (typeof errorCode === "string" && errorCode.trim()) {
      return `Email delivery error (${errorCode.trim()})`.slice(0, errorMaxLength);
    }
  }

  if (typeof error === "string") {
    return error.slice(0, errorMaxLength);
  }

  return "Unknown email delivery error.";
}
