const csvFormulaPrefixes = new Set(["=", "+", "-", "@", "\t", "\r"]);

function normalizeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
}

export function preventCsvFormulaInjection(value: unknown): string {
  const normalizedValue = normalizeCsvValue(value);
  const trimmedStart = normalizedValue.trimStart();
  if (!trimmedStart) {
    return normalizedValue;
  }

  const firstChar = trimmedStart[0] ?? "";
  if (!csvFormulaPrefixes.has(firstChar)) {
    return normalizedValue;
  }

  return `'${normalizedValue}`;
}

export function escapeCsvCell(value: unknown): string {
  const safeValue = preventCsvFormulaInjection(value);
  if (!/[",\n\r]/.test(safeValue)) {
    return safeValue;
  }

  return `"${safeValue.replaceAll("\"", "\"\"")}"`;
}
