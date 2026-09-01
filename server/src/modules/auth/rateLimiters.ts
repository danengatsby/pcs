import { createHash } from "node:crypto";
import { env } from "../../lib/env.js";
import { createRateLimiter } from "../../lib/rateLimit.js";
import { readBodyEmail, readClientIp } from "./requestContext.js";

function hashRateLimitEmail(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

export const signupRateLimiter = createRateLimiter({
  scope: "auth-signup",
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
  errorCode: "AUTH_RATE_LIMITED",
  errorMessage: "Prea multe incercari de autentificare. Incearca din nou peste cateva minute.",
});

export const signupAccountRateLimiter = createRateLimiter({
  scope: "auth-signup-account",
  windowMs: env.authRateLimitWindowMs,
  max: Math.max(3, Math.floor(env.authRateLimitMax / 2)),
  errorCode: "AUTH_RATE_LIMITED",
  errorMessage: "Prea multe incercari pentru acest cont. Incearca din nou peste cateva minute.",
  keyGenerator: (req) => {
    const email = readBodyEmail(req);
    return email ? hashRateLimitEmail(email) : readClientIp(req);
  },
});

export const signinRateLimiter = createRateLimiter({
  scope: "auth-signin",
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
  errorCode: "AUTH_RATE_LIMITED",
  errorMessage: "Prea multe incercari de autentificare. Incearca din nou peste cateva minute.",
  keyGenerator: (req) => {
    const ip = readClientIp(req);
    const email = readBodyEmail(req);
    return email ? `${ip}|${hashRateLimitEmail(email)}` : ip;
  },
});

export const signinAccountRateLimiter = createRateLimiter({
  scope: "auth-signin-account",
  windowMs: env.authRateLimitWindowMs,
  max: Math.max(3, Math.floor(env.authRateLimitMax / 2)),
  errorCode: "AUTH_RATE_LIMITED",
  errorMessage: "Prea multe incercari pentru acest cont. Incearca din nou peste cateva minute.",
  keyGenerator: (req) => {
    const email = readBodyEmail(req);
    return email ? hashRateLimitEmail(email) : readClientIp(req);
  },
});

export const refreshRateLimiter = createRateLimiter({
  scope: "auth-refresh",
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
  errorCode: "AUTH_RATE_LIMITED",
  errorMessage: "Prea multe incercari de refresh token. Incearca din nou peste cateva minute.",
  keyGenerator: (req) => readClientIp(req),
});
