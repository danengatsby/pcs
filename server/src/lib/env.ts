import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readAuthRateLimitMax,
  readAuthRateLimitWindowMs,
  readBindHost,
  readCorsCredentials,
  readCorsOrigins,
  readDatabaseUrl,
  readHealthcheckDbTimeoutMs,
  readLogLevel,
  readPort,
  readShutdownGraceMs,
  readVolunteerRateLimitMax,
  readVolunteerRateLimitWindowMs,
} from "./env/appConfig.js";
import {
  readAuthRefreshEnabled,
  readAuthRefreshStore,
  readAuthRefreshTtlSeconds,
  readAuthTokenAudience,
  readAuthTokenIssuer,
  readAuthTokenSecret,
  readAuthTokenTtlSeconds,
  validateAuthTokenPolicy,
} from "./env/authConfig.js";
import {
  readEmailFrom,
  readEmailNewsPublishRecipients,
  readEmailNotificationsEnabled,
  readEmailReplyTo,
  readEmailSendTimeoutMs,
  readEmailSmtpHost,
  readEmailSmtpPass,
  readEmailSmtpPort,
  readEmailSmtpRequireStartTls,
  readEmailSmtpSecure,
  readEmailSmtpUser,
  validateSmtpCredentials,
} from "./env/emailConfig.js";
import {
  readMetricsBearerToken,
  readMetricsEnabled,
  validateMetricsPolicy,
} from "./env/metricsConfig.js";
import {
  readNodeEnv,
  readPublicBaseUrl,
} from "./env/shared.js";
import {
  readForceHttpsUpgrade,
  readTrustProxy,
} from "./env/securityConfig.js";
import {
  readRedisConnectTimeoutMs,
  readRedisKeyPrefix,
  readRedisUrl,
} from "./env/redisConfig.js";
import { readRateLimitStore } from "./env/rateLimitConfig.js";
import {
  readOtelEnabled,
  readOtelExporterUrl,
} from "./env/telemetryConfig.js";
import { validateClamAvConfigForEnvironment } from "./clamav.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const envPath = path.resolve(currentDir, "../../.env");

dotenv.config({ path: envPath });

const nodeEnv = readNodeEnv();
const publicBaseUrl = readPublicBaseUrl();
validateClamAvConfigForEnvironment(nodeEnv);

const corsOrigins = readCorsOrigins();
const corsCredentials = readCorsCredentials();

const authTokenTtlSeconds = readAuthTokenTtlSeconds();
const authRefreshEnabled = readAuthRefreshEnabled();
const authRefreshTtlSeconds = readAuthRefreshTtlSeconds();
const authRefreshStore = readAuthRefreshStore();
const redisUrl = readRedisUrl();
const rateLimitStore = readRateLimitStore();
const instanceCount = Number(process.env.APP_INSTANCE_COUNT?.trim() ?? "1");

if (!Number.isInteger(instanceCount) || instanceCount <= 0) {
  throw new Error("APP_INSTANCE_COUNT invalid.");
}
if (nodeEnv === "production" && instanceCount > 1 && rateLimitStore !== "redis") {
  throw new Error("RATE_LIMIT_STORE=redis este obligatoriu in productie cu mai multe instante.");
}
if (nodeEnv === "production" && instanceCount > 1 && !redisUrl) {
  throw new Error("REDIS_URL este obligatoriu in productie cu mai multe instante.");
}

const metricsEnabled = readMetricsEnabled(nodeEnv);
const metricsBearerToken = readMetricsBearerToken();

const emailNotificationsEnabled = readEmailNotificationsEnabled();
const emailSmtpUser = readEmailSmtpUser();
const emailSmtpPass = readEmailSmtpPass();

validateAuthTokenPolicy({
  authTokenTtlSeconds,
  authRefreshEnabled,
  authRefreshTtlSeconds,
  authRefreshStore,
  redisUrl,
});

validateMetricsPolicy({
  nodeEnv,
  metricsEnabled,
  metricsBearerToken,
});

validateSmtpCredentials(emailSmtpUser, emailSmtpPass);

if (corsCredentials && corsOrigins.includes("*")) {
  throw new Error(
    "Configuratie CORS invalida: CORS_ORIGIN nu poate include '*' cand CORS_CREDENTIALS este true."
  );
}

export const env = {
  nodeEnv,
  port: readPort(),
  bindHost: readBindHost(nodeEnv),
  corsOrigins,
  corsCredentials,
  databaseUrl: readDatabaseUrl(),
  logLevel: readLogLevel(),
  volunteerRateLimitWindowMs: readVolunteerRateLimitWindowMs(),
  volunteerRateLimitMax: readVolunteerRateLimitMax(),
  authRateLimitWindowMs: readAuthRateLimitWindowMs(),
  authRateLimitMax: readAuthRateLimitMax(),
  rateLimitStore,
  instanceCount,
  healthcheckDbTimeoutMs: readHealthcheckDbTimeoutMs(),
  shutdownGraceMs: readShutdownGraceMs(),
  forceHttpsUpgrade: readForceHttpsUpgrade(),
  trustProxy: readTrustProxy(),
  authTokenSecret: readAuthTokenSecret(nodeEnv),
  authTokenTtlSeconds,
  authTokenIssuer: readAuthTokenIssuer(),
  authTokenAudience: readAuthTokenAudience(),
  authRefreshEnabled,
  authRefreshTtlSeconds,
  authRefreshStore,
  redisUrl,
  redisKeyPrefix: readRedisKeyPrefix(),
  redisConnectTimeoutMs: readRedisConnectTimeoutMs(),
  metricsEnabled,
  metricsBearerToken,
  emailNotificationsEnabled,
  emailFrom: readEmailFrom(emailNotificationsEnabled),
  emailReplyTo: readEmailReplyTo(),
  emailSmtpHost: readEmailSmtpHost(emailNotificationsEnabled),
  emailSmtpPort: readEmailSmtpPort(),
  emailSmtpSecure: readEmailSmtpSecure(),
  emailSmtpRequireStartTls: readEmailSmtpRequireStartTls(),
  emailSmtpUser,
  emailSmtpPass,
  emailSendTimeoutMs: readEmailSendTimeoutMs(),
  emailNewsPublishRecipients: readEmailNewsPublishRecipients(),
  publicBaseUrl,
  otelEnabled: readOtelEnabled(),
  otelExporterUrl: readOtelExporterUrl(),
};

export type AppEnv = typeof env;
