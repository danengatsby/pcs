import type { RequestHandler } from "express";
import { env } from "../lib/env.js";
import { sendError, sendSuccess } from "../lib/http.js";
import { renderMetrics } from "../lib/metrics.js";
import { isMetricsAuthorized } from "./metricsAuth.js";
import { buildLivenessPayload, buildReadinessReport } from "./health.js";
import type { ApiRouteDefinition } from "./apiRouteTypes.js";
import { authRoutes } from "./apiRoutes/authRoutes.js";
import { adminRoutes } from "./apiRoutes/adminRoutes.js";
import { contentRoutes } from "./apiRoutes/contentRoutes.js";
import { membershipRoutes } from "./apiRoutes/membershipRoutes.js";
import { publicRoutes } from "./apiRoutes/publicRoutes.js";

const liveHealthHandler: RequestHandler = (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  sendSuccess(res, buildLivenessPayload());
};

const readinessHandler: RequestHandler = async (_req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const report = await buildReadinessReport();
    sendSuccess(res, report, { status: report.ready ? 200 : 503 });
  } catch (error) {
    next(error);
  }
};

const metricsHandler: RequestHandler = (req, res) => {
  if (!isMetricsAuthorized(req)) {
    sendError(res, 401, {
      code: "METRICS_UNAUTHORIZED",
      message: "Acces neautorizat la endpoint-ul de metrici.",
    });
    return;
  }

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(renderMetrics());
};

const systemRoutes: ApiRouteDefinition[] = [
  { method: "GET", url: "/api/health/live", handlers: [liveHealthHandler] },
  { method: "GET", url: "/api/health/ready", handlers: [readinessHandler] },
  { method: "GET", url: "/api/health", handlers: [readinessHandler] },
];

export function getApiRouteDefinitions(): ApiRouteDefinition[] {
  const routes = [
    ...systemRoutes,
    ...publicRoutes,
    ...authRoutes,
    ...membershipRoutes,
    ...contentRoutes,
    ...adminRoutes,
  ];

  if (!env.metricsEnabled) {
    return routes;
  }

  return [
    ...systemRoutes,
    { method: "GET", url: "/api/metrics", handlers: [metricsHandler] },
    ...routes.slice(systemRoutes.length),
  ];
}
