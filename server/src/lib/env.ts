import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readAuthRateLimitMax,
  readAuthRateLimitWindowMs,
  readCorsCredentials,
  readCorsOrigins,
  readDatabaseUrl,
  readHealthcheckDbTimeoutMs,
  readHttpServerAdapter,
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
  readCaptchaExpectedAction,
  readCaptchaExpectedHostname,
  readCaptchaMinScore,
  readCaptchaMode,
  readCaptchaSecret,
  readCaptchaVerifyUrl,
} from "./env/captchaConfig.js";
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

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const envPath = path.resolve(currentDir, "../../.env");

dotenv.config({ path: envPath });

const nodeEnv = readNodeEnv();
const publicBaseUrl = readPublicBaseUrl();

const corsOrigins = readCorsOrigins();
const corsCredentials = readCorsCredentials();

const authTokenTtlSeconds = readAuthTokenTtlSeconds();
const authRefreshEnabled = readAuthRefreshEnabled();
const authRefreshTtlSeconds = readAuthRefreshTtlSeconds();
const authRefreshStore = readAuthRefreshStore();
const redisUrl = readRedisUrl();
const rateLimitStore = readRateLimitStore();

const metricsEnabled = readMetricsEnabled(nodeEnv);
const metricsBearerToken = readMetricsBearerToken();

const captchaMode = readCaptchaMode(nodeEnv);

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
  httpServerAdapter: readHttpServerAdapter(),
  port: readPort(),
  corsOrigins,
  corsCredentials,
  databaseUrl: readDatabaseUrl(),
  logLevel: readLogLevel(),
  volunteerRateLimitWindowMs: readVolunteerRateLimitWindowMs(),
  volunteerRateLimitMax: readVolunteerRateLimitMax(),
  authRateLimitWindowMs: readAuthRateLimitWindowMs(),
  authRateLimitMax: readAuthRateLimitMax(),
  rateLimitStore,
  healthcheckDbTimeoutMs: readHealthcheckDbTimeoutMs(),
  shutdownGraceMs: readShutdownGraceMs(),
  captchaMode,
  captchaSecret: readCaptchaSecret(captchaMode),
  captchaVerifyUrl: readCaptchaVerifyUrl(),
  captchaExpectedAction: readCaptchaExpectedAction(),
  captchaExpectedHostname: readCaptchaExpectedHostname(publicBaseUrl),
  captchaMinScore: readCaptchaMinScore(),
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
