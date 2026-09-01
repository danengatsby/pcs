type RateLimitStore = "db" | "redis";

export function readRateLimitStore(): RateLimitStore {
  const raw = (process.env.RATE_LIMIT_STORE ?? "db").trim().toLowerCase();

  if (raw === "db" || raw === "redis") {
    return raw;
  }

  throw new Error("RATE_LIMIT_STORE invalid. Expected 'db' or 'redis'.");
}
