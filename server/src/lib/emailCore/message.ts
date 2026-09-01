import { randomUUID } from "node:crypto";
import { env } from "../env.js";
import type { SendEmailInput } from "./types.js";

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function normalizeRecipients(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const normalized = raw.trim().toLowerCase();
    if (!isLikelyEmail(normalized) || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function dotStuffBody(rawText: string): string {
  const normalized = rawText.replace(/\r?\n/g, "\r\n");
  const lines = normalized.split("\r\n");
  return lines.map((line) => (line.startsWith(".") ? `.${line}` : line)).join("\r\n");
}

export function buildRawMessage(input: SendEmailInput, recipients: string[]): string {
  const subject = sanitizeHeaderValue(input.subject);
  const from = sanitizeHeaderValue(env.emailFrom);
  const toHeader = recipients.join(", ");
  const replyTo = sanitizeHeaderValue(input.replyTo?.trim() || env.emailReplyTo || "");
  const messageId = `<${randomUUID()}@${env.emailSmtpHost || "pcs.local"}>`;
  const body = dotStuffBody(input.text);

  const headers = [
    `From: ${from}`,
    `To: ${toHeader}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
  ];

  if (replyTo) {
    headers.push(`Reply-To: ${replyTo}`);
  }

  return `${headers.join("\r\n")}\r\n\r\n${body}\r\n`;
}
