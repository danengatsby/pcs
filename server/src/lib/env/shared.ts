export function readNodeEnv(): string {
  return process.env.NODE_ENV?.trim().toLowerCase() ?? "";
}

export function isRelaxedEnvironment(nodeEnv: string): boolean {
  return nodeEnv === "development" || nodeEnv === "test";
}

export function readPositiveInt(raw: string, name: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} invalid: ${raw}`);
  }
  return parsed;
}

export function readBooleanFlag(rawValue: string | undefined, fallback: boolean): boolean {
  if (rawValue === undefined) {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`Valoare booleana invalida: ${rawValue}`);
}

export function readPublicBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL?.trim() ?? "";
}

export function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
