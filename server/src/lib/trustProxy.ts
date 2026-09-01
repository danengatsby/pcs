export type TrustProxyValue = boolean | string | string[];

const truthyValues = new Set(["true", "yes", "on"]);
const falsyValues = new Set(["false", "no", "off"]);

export function parseTrustProxy(rawValue: string | undefined, fallback: TrustProxyValue = false): TrustProxyValue {
  if (rawValue === undefined) {
    return fallback;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return fallback;
  }

  const normalized = trimmed.toLowerCase();
  if (truthyValues.has(normalized)) {
    return true;
  }
  if (falsyValues.has(normalized)) {
    return false;
  }

  if (/^\d+$/.test(trimmed)) {
    throw new Error(
      "TRUST_PROXY numeric nu este acceptat; configurati explicit adresa IP sau CIDR a proxy-ului."
    );
  }

  if (trimmed.includes(",")) {
    const values = trimmed
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (values.length > 0) {
      return values;
    }
  }

  return trimmed;
}
