const knownHttpMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);
const uuidSegmentPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hexSegmentPattern = /^[0-9a-f]{16,}$/i;
const numberSegmentPattern = /^\d+$/;

export function readStatusClass(statusCode: number): string {
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    return "unknown";
  }
  return `${Math.floor(statusCode / 100)}xx`;
}

export function normalizeMethod(method: string): string {
  const normalized = method.trim().toUpperCase();
  if (!normalized) {
    return "UNKNOWN";
  }
  return knownHttpMethods.has(normalized) ? normalized : "OTHER";
}

export function normalizeMetricCode(rawCode: string): string {
  const normalized = rawCode.trim().toUpperCase();
  if (!normalized) {
    return "UNKNOWN";
  }
  return normalized.replace(/[^A-Z0-9_:.\\/-]/g, "_").slice(0, 160);
}

export function normalizeMetricAction(rawAction: string): string {
  const normalized = rawAction.trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  return normalized.replace(/[^a-z0-9_.\\/-]/g, "_").slice(0, 160);
}

function normalizePathSegment(segment: string): string {
  if (!segment) {
    return "";
  }
  if (numberSegmentPattern.test(segment)) {
    return ":id";
  }
  if (uuidSegmentPattern.test(segment)) {
    return ":uuid";
  }
  if (hexSegmentPattern.test(segment)) {
    return ":hex";
  }
  if (segment.length > 48) {
    return ":segment";
  }
  return segment.toLowerCase();
}

export function normalizeRouteLabel(rawRoute: string): string {
  const withoutQuery = rawRoute.split("?")[0] ?? "";
  if (!withoutQuery || withoutQuery === "/") {
    return "/";
  }

  const segments = withoutQuery.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "/";
  }

  const normalized: string[] = [];
  const maxSegments = 8;
  for (let index = 0; index < segments.length; index += 1) {
    if (index >= maxSegments) {
      normalized.push(":tail");
      break;
    }
    normalized.push(normalizePathSegment(segments[index] ?? ""));
  }

  return `/${normalized.join("/")}`;
}

export function isAuthFailureCode(code: string): boolean {
  const normalized = normalizeMetricCode(code);
  return normalized.startsWith("AUTH_") || normalized === "INVALID_CREDENTIALS";
}
