export type RedactionReplacement = "[REDACTED]";

const REDACTED: RedactionReplacement = "[REDACTED]";

/**
 * Lowercased header names that may contain secrets / PII.
 * (We redact both request and response headers.)
 */
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-csrf-token",
  "x-xsrf-token",
]);

const SENSITIVE_QUERY_KEYS = new Set([
  "email",
  "phone",
  "token",
  "access_token",
  "refresh_token",
  "password",
  "csrf",
  "csrf_token",
  "xsrf",
  "xsrf_token",
  "code",
  "otp",
]);

export function redactHeaders(
  headers: Record<string, unknown> | undefined | null
): Record<string, unknown> | undefined {
  if (!headers || typeof headers !== "object") {
    return undefined;
  }

  const result: Record<string, unknown> = {};

  for (const [rawKey, rawValue] of Object.entries(headers)) {
    const key = rawKey.toLowerCase();
    if (SENSITIVE_HEADERS.has(key)) {
      result[rawKey] = REDACTED;
      continue;
    }

    result[rawKey] = rawValue;
  }

  return result;
}

export function redactQuery(
  query: unknown
): unknown {
  if (!query || typeof query !== "object") {
    return query;
  }

  // Fastify query can be object with string/array values.
  const input = query as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      result[key] = REDACTED;
      continue;
    }

    result[key] = value;
  }

  return result;
}
