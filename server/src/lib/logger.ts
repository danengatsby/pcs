import pino from "pino";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pinoHttp } from "pino-http";
import { env } from "./env.js";

const sensitiveLogPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
] as const;

export const appLogger = pino({
  level: env.logLevel,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [...sensitiveLogPaths],
    remove: true,
  },
});

export const httpLogger = pinoHttp({
  logger: appLogger,
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, error?: Error) => {
    const statusCode = res.statusCode ?? 500;
    if (error || statusCode >= 500) {
      return "error";
    }
    if (statusCode >= 400) {
      return "warn";
    }
    return "info";
  },
  customProps: (_req: IncomingMessage, res: ServerResponse) => {
    const locals = (res as ServerResponse & { locals?: { requestId?: string } }).locals;
    return {
      requestId: locals?.requestId ?? "unknown",
    };
  },
});
