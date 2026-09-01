import { isIP } from "node:net";
import { readBooleanFlag, readPositiveInt } from "./shared.js";

export type HttpServerAdapter = "express" | "fastify";

export function readPort(): number {
  const raw = process.env.PORT ?? "4000";
  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`PORT invalid: ${raw}`);
  }

  return parsed;
}

export function readBindHost(nodeEnv: string): string {
  const defaultHost = nodeEnv === "production" ? "127.0.0.1" : "0.0.0.0";
  const raw = process.env.BIND_HOST?.trim() || defaultHost;

  if (isIP(raw) === 0) {
    throw new Error(`BIND_HOST invalid: ${raw}. Configureaza o adresa IPv4 sau IPv6.`);
  }

  return raw;
}

export function readCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? "http://localhost:5173";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function readCorsCredentials(): boolean {
  return readBooleanFlag(process.env.CORS_CREDENTIALS, true);
}

export function readDatabaseUrl(): string {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
  if (process.env.NODE_ENV?.trim().toLowerCase() === "test" && testDatabaseUrl) {
    return testDatabaseUrl;
  }

  const directUrl = process.env.DATABASE_URL?.trim();
  if (directUrl) {
    return directUrl;
  }

  const host = process.env.POSTGRES_HOST?.trim();
  const portRaw = process.env.POSTGRES_PORT?.trim() ?? "5432";
  const database = process.env.POSTGRES_DB?.trim();
  const user = process.env.POSTGRES_USER?.trim();
  const password = process.env.POSTGRES_PASSWORD ?? "";

  if (!host || !database || !user) {
    throw new Error(
      "Lipsesc configurari DB. Seteaza DATABASE_URL sau POSTGRES_HOST/POSTGRES_PORT/POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD in server/.env."
    );
  }

  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`POSTGRES_PORT invalid: ${portRaw}`);
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const encodedDatabase = encodeURIComponent(database);
  const auth = password ? `${encodedUser}:${encodedPassword}` : encodedUser;

  return `postgres://${auth}@${host}:${port}/${encodedDatabase}`;
}

export function readLogLevel(): string {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase() ?? "info";
  const allowed = ["fatal", "error", "warn", "info", "debug", "trace", "silent"];
  if (!allowed.includes(raw)) {
    throw new Error(`LOG_LEVEL invalid: ${raw}`);
  }
  return raw;
}

export function readVolunteerRateLimitWindowMs(): number {
  const raw = process.env.VOLUNTEER_RATE_LIMIT_WINDOW_MS?.trim() ?? "600000";
  return readPositiveInt(raw, "VOLUNTEER_RATE_LIMIT_WINDOW_MS");
}

export function readVolunteerRateLimitMax(): number {
  const raw = process.env.VOLUNTEER_RATE_LIMIT_MAX?.trim() ?? "5";
  return readPositiveInt(raw, "VOLUNTEER_RATE_LIMIT_MAX");
}

export function readAuthRateLimitWindowMs(): number {
  const raw = process.env.AUTH_RATE_LIMIT_WINDOW_MS?.trim() ?? "600000";
  return readPositiveInt(raw, "AUTH_RATE_LIMIT_WINDOW_MS");
}

export function readAuthRateLimitMax(): number {
  const raw = process.env.AUTH_RATE_LIMIT_MAX?.trim() ?? "10";
  return readPositiveInt(raw, "AUTH_RATE_LIMIT_MAX");
}

export function readHealthcheckDbTimeoutMs(): number {
  const raw = process.env.HEALTHCHECK_DB_TIMEOUT_MS?.trim() ?? "2000";
  return readPositiveInt(raw, "HEALTHCHECK_DB_TIMEOUT_MS");
}

export function readShutdownGraceMs(): number {
  const raw = process.env.SHUTDOWN_GRACE_MS?.trim() ?? "15000";
  return readPositiveInt(raw, "SHUTDOWN_GRACE_MS");
}

export function readHttpServerAdapter(): HttpServerAdapter {
  const raw = process.env.HTTP_SERVER_ADAPTER?.trim().toLowerCase() ?? "fastify";
  if (raw === "express" || raw === "fastify") {
    return raw;
  }

  throw new Error(`HTTP_SERVER_ADAPTER invalid: ${raw}`);
}
