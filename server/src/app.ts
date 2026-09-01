import express from "express";
import compression from "compression";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { httpLogger } from "./lib/logger.js";
import { createErrorHandler } from "./appCore/errorHandler.js";
import {
  applyCoreSecurityMiddleware,
  requestIdMiddleware,
  requestLatencyMetricsMiddleware,
} from "./appCore/middleware.js";
import {
  registerApiRoutes,
  registerApiNotFoundRoute,
  registerClientSpaFallback,
} from "./appCore/routes.js";
import {
  setupSwaggerUI,
} from "./lib/swaggerUI.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const clientDistPath = path.resolve(currentDir, "../../client/dist");
const uploadsPath = path.resolve(currentDir, "../uploads");

export function createApp(): express.Express {
  const app = express();

  applyCoreSecurityMiddleware(app);
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      // Don't compress health checks or already-compressed responses
      if (req.url?.includes('/health')) {
        return false;
      }
      return compression.filter(req, res);
    },
  }));
  app.use(requestIdMiddleware);
  app.use(requestLatencyMetricsMiddleware);
  app.use(httpLogger);
  app.use(express.json({ limit: "300kb" }));

  // Setup Swagger/OpenAPI documentation
  setupSwaggerUI(app);

  registerApiRoutes(app, uploadsPath);
  registerApiNotFoundRoute(app);
  registerClientSpaFallback(app, clientDistPath);

  app.use(createErrorHandler());
  return app;
}
