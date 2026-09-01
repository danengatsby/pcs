import { env } from "../../lib/env.js";
import { createRateLimiter } from "../../lib/rateLimit.js";

export const volunteersRateLimiter = createRateLimiter({
  scope: "volunteers",
  windowMs: env.volunteerRateLimitWindowMs,
  max: env.volunteerRateLimitMax,
  errorCode: "RATE_LIMITED",
  errorMessage: "Prea multe solicitari. Incearca din nou peste cateva minute.",
});
