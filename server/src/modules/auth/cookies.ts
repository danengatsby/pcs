import type { Request, Response } from "express";
import { env } from "../../lib/env.js";
import {
  refreshCookiePath,
  refreshCsrfCookieName,
  refreshCsrfHeaderName,
  refreshTokenCookieName,
  type ParsedCookies,
} from "./types.js";

function parseCookies(rawHeader: string | undefined): ParsedCookies {
  const parsed: ParsedCookies = {};
  if (!rawHeader) {
    return parsed;
  }

  for (const item of rawHeader.split(";")) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      continue;
    }

    try {
      parsed[key] = decodeURIComponent(value);
    } catch {
      parsed[key] = value;
    }
  }

  return parsed;
}

function readRequestCookie(req: Request, name: string): string {
  const cookies = parseCookies(req.header("cookie"));
  const rawValue = cookies[name];
  if (!rawValue) {
    return "";
  }

  return rawValue.trim();
}

export function readRefreshCookie(req: Request): string {
  return readRequestCookie(req, refreshTokenCookieName);
}

export function readRefreshCsrfCookie(req: Request): string {
  return readRequestCookie(req, refreshCsrfCookieName);
}

export function readRefreshCsrfHeader(req: Request): string {
  return req.header(refreshCsrfHeaderName)?.trim() ?? "";
}

export function setRefreshCookies(
  res: Response,
  session: { token: string; csrfToken: string; expiresInSeconds: number }
): void {
  const maxAge = session.expiresInSeconds * 1000;
  const secure = env.nodeEnv === "production" || env.forceHttpsUpgrade;

  res.cookie(refreshTokenCookieName, session.token, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: refreshCookiePath,
    maxAge,
  });

  res.cookie(refreshCsrfCookieName, session.csrfToken, {
    httpOnly: false,
    sameSite: "strict",
    secure,
    path: refreshCookiePath,
    maxAge,
  });
}

export function clearRefreshCookies(res: Response): void {
  const secure = env.nodeEnv === "production" || env.forceHttpsUpgrade;
  res.clearCookie(refreshTokenCookieName, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: refreshCookiePath,
  });
  res.clearCookie(refreshCsrfCookieName, {
    httpOnly: false,
    sameSite: "strict",
    secure,
    path: refreshCookiePath,
  });
}
