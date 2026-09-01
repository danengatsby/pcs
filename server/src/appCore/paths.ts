import type { Request } from "express";

export const refreshEndpointRoute = "/api/auth/refresh";

export function readRequestPath(req: Request): string {
  const rawPath = req.originalUrl ?? req.url ?? "/";
  const withoutQuery = rawPath.split("?")[0] ?? "/";
  if (!withoutQuery) {
    return "/";
  }
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
}
