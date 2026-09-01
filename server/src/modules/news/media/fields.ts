export function readFormField(fields: Record<string, unknown>, key: string): string {
  const raw = fields[key];
  if (typeof raw === "string") {
    return raw.trim();
  }

  if (Array.isArray(raw) && typeof raw[0] === "string") {
    return raw[0].trim();
  }

  return "";
}
