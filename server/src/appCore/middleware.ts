import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { env } from "../lib/env.js";
import { observeHttpRequestDuration } from "../lib/metrics.js";
import { buildPermissionsPolicyHeaderValue } from "../lib/permissionsPolicy.js";
import { readRequestPath } from "./paths.js";

function buildCspDirectives(): Record<string, string[] | null> {
  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    fontSrc: ["'self'", "https:", "data:"],
    styleSrc: ["'self'", "'unsafe-inline'", "https:"],
    scriptSrc: ["'self'"],
    frameSrc: ["'self'"],
    connectSrc: ["'self'"],
    upgradeInsecureRequests: env.forceHttpsUpgrade ? [] : null,
  };
}

export function applyCoreSecurityMiddleware(app: express.Express): void {
  const permissionsPolicyHeaderValue = buildPermissionsPolicyHeaderValue();

  app.disable("x-powered-by");
  app.set("trust proxy", env.trustProxy);
  app.use(
    helmet({
      hsts: env.forceHttpsUpgrade
        ? undefined
        : false,
      contentSecurityPolicy: {
        directives: buildCspDirectives(),
      },
    })
  );
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", permissionsPolicyHeaderValue);
    next();
  });
  const allowAllOrigins = env.corsOrigins.includes("*");
  const allowedOrigins = new Set(env.corsOrigins);

  app.use(
    cors({
      origin(origin, callback) {
        // Non-browser requests may omit Origin; don't reflect/allow implicitly.
        if (!origin) {
          callback(null, false);
          return;
        }

        if (allowAllOrigins) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
      credentials: env.corsCredentials,
    })
  );
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingRequestId = req.header("x-request-id")?.trim();
  const requestId = incomingRequestId && incomingRequestId.length <= 120
    ? incomingRequestId
    : randomUUID();

  (res.locals as { requestId?: string }).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

export function requestLatencyMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
    observeHttpRequestDuration({
      method: req.method,
      route: readRequestPath(req),
      statusCode: res.statusCode,
      durationSeconds: Number(elapsedNanoseconds) / 1_000_000_000,
    });
  });
  next();
}
