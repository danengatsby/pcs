import type { Request } from "express";

export function readClientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function readUserAgent(req: Request): string {
  const userAgent = req.header("user-agent");
  return (userAgent ?? "").trim().slice(0, 255);
}

export function readBodyEmail(req: Request): string {
  const raw = req.body && typeof req.body === "object"
    ? (req.body as { email?: unknown }).email
    : undefined;

  if (typeof raw !== "string") {
    return "";
  }

  return raw.trim().toLowerCase();
}
