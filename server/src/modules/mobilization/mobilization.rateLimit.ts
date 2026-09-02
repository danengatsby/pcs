import { env } from "../../lib/env.js";
import { createRateLimiter } from "../../lib/rateLimit.js";

export const mobilizationRateLimiter = createRateLimiter({
  scope: "mobilization",
  windowMs: env.volunteerRateLimitWindowMs,
  max: env.volunteerRateLimitMax,
  errorCode: "RATE_LIMITED",
  errorMessage: "Prea multe răspunsuri trimise. Încearcă din nou peste câteva minute.",
});
