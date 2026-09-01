export const manifestPageFileName = "manifest_pcs.html";

export function buildManifestPageCspHeaderValue(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https:",
    "script-src 'none'",
    "connect-src 'self' https:",
  ].join(";");
}
