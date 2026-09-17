import { randomBytes } from "node:crypto";
import { isRelaxedEnvironment, readBooleanFlag, readPositiveInt } from "./shared.js";

export type AuthRefreshStore = "sql" | "redis";

export function readAuthMfaEncryptionKey(nodeEnv: string): string {
  const key = process.env.AUTH_MFA_ENCRYPTION_KEY?.trim() ?? "";
  if (key && !/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error("AUTH_MFA_ENCRYPTION_KEY trebuie să conțină exact 64 de caractere hexazecimale.");
  }
  if (!key && nodeEnv === "production") {
    throw new Error("AUTH_MFA_ENCRYPTION_KEY este obligatorie în producție.");
  }
  // A deterministic test key is isolated by NODE_ENV and the test DB guard.
  return key || (nodeEnv === "test" ? "a1".repeat(32) : "");
}

export function readAuthTokenSecret(nodeEnv: string): string {
  const raw = process.env.AUTH_TOKEN_SECRET?.trim();
  if (raw) {
    if (raw.length < 32) {
      throw new Error("AUTH_TOKEN_SECRET trebuie sa aiba minimum 32 caractere.");
    }
    return raw;
  }

  if (isRelaxedEnvironment(nodeEnv)) {
    return randomBytes(48).toString("hex");
  }

  throw new Error(
    "AUTH_TOKEN_SECRET lipseste. Configureaza o cheie de minimum 32 caractere in server/.env."
  );
}

export function readAuthTokenTtlSeconds(): number {
  const raw = process.env.AUTH_TOKEN_TTL_SECONDS?.trim() ?? "86400";
  return readPositiveInt(raw, "AUTH_TOKEN_TTL_SECONDS");
}

export function readAuthTokenIssuer(): string {
  const raw = process.env.AUTH_TOKEN_ISSUER?.trim() ?? "pcs-api";
  if (!raw) {
    throw new Error("AUTH_TOKEN_ISSUER invalid.");
  }
  return raw;
}

export function readAuthTokenAudience(): string {
  const raw = process.env.AUTH_TOKEN_AUDIENCE?.trim() ?? "pcs-client";
  if (!raw) {
    throw new Error("AUTH_TOKEN_AUDIENCE invalid.");
  }
  return raw;
}

export function readAuthRefreshEnabled(): boolean {
  return readBooleanFlag(process.env.AUTH_REFRESH_ENABLED, false);
}

export function readAuthRefreshTtlSeconds(): number {
  const raw = process.env.AUTH_REFRESH_TTL_SECONDS?.trim() ?? "1209600";
  return readPositiveInt(raw, "AUTH_REFRESH_TTL_SECONDS");
}

export function readAuthRefreshStore(): AuthRefreshStore {
  const raw = process.env.AUTH_REFRESH_STORE?.trim().toLowerCase() ?? "sql";
  if (raw === "sql" || raw === "redis") {
    return raw;
  }

  throw new Error(`AUTH_REFRESH_STORE invalid: ${raw}`);
}

export function validateAuthTokenPolicy(config: {
  authTokenTtlSeconds: number;
  authRefreshEnabled: boolean;
  authRefreshTtlSeconds: number;
  authRefreshStore: AuthRefreshStore;
  redisUrl: string;
}): void {
  if (!config.authRefreshEnabled) {
    return;
  }

  if (config.authRefreshTtlSeconds <= config.authTokenTtlSeconds) {
    throw new Error(
      "Configuratie auth invalida: AUTH_REFRESH_TTL_SECONDS trebuie sa fie mai mare decat AUTH_TOKEN_TTL_SECONDS."
    );
  }

  if (config.authRefreshStore === "redis" && !config.redisUrl) {
    throw new Error(
      "Configuratie auth invalida: REDIS_URL este obligatoriu cand AUTH_REFRESH_STORE=redis."
    );
  }
}
