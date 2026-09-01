import type { RequestHandler } from "express";
import { requireAuth, requireRole } from "../lib/authMiddleware.js";
import { env } from "../lib/env.js";
import { sendError, sendSuccess } from "../lib/http.js";
import { renderMetrics } from "../lib/metrics.js";
import { isMetricsAuthorized } from "./metricsAuth.js";
import { buildLivenessPayload, buildReadinessReport } from "./health.js";
import { listAdminAuditHandler } from "../modules/admin/handlers/listAdminAudit.js";
import { sendAdminEmailTestHandler } from "../modules/admin/handlers/sendAdminEmailTest.js";
import {
  bulkDeleteAdminVolunteerHandler,
  bulkUpdateAdminVolunteerWorkflowHandler,
  deleteAdminVolunteerHandler,
  exportAdminVolunteersCsvHandler,
  getAdminVolunteerByIdHandler,
  listAdminVolunteerOwnersHandler,
  listAdminVolunteersHandler,
  updateAdminVolunteerWorkflowHandler,
} from "../modules/volunteers/handlers/admin/index.js";
import {
  handleSignout,
  meHandler,
  policyHandler,
  refreshHandler,
  revokeAllSessionsHandler,
  signinHandler,
  signupHandler,
} from "../modules/auth/handlers/index.js";
import {
  refreshRateLimiter,
  signinAccountRateLimiter,
  signinRateLimiter,
  signupAccountRateLimiter,
  signupRateLimiter,
} from "../modules/auth/rateLimiters.js";
import { listMembersController } from "../modules/members/members.controller.js";
import { listAdminMembersDashboardController } from "../modules/members/adminDashboard.controller.js";
import { listOrganizationsController } from "../modules/organizations/organizations.controller.js";
import { listFinanceController } from "../modules/finance/finance.controller.js";
import { listElectionsController } from "../modules/elections/elections.controller.js";
import { listStatsHandler } from "../modules/stats/handlers/listStats.js";
import {
  createAdminNews,
  deleteAdminNews,
  getAdminNewsById,
  listAdminNews,
  updateAdminNews,
} from "../modules/news/handlers/admin/index.js";
import {
  deleteMediaAsset,
  listMediaLibrary,
  uploadMedia,
} from "../modules/news/handlers/media/index.js";
import {
  getPublicNewsById,
  listPublicNews,
} from "../modules/news/handlers/public/index.js";
import {
  createVolunteerHandler,
  listVolunteerCountiesHandler,
  listVolunteersByCountyHandler,
  listPublicVolunteersHandler,
} from "../modules/volunteers/handlers/public/index.js";
import { volunteersRateLimiter } from "../modules/volunteers/rateLimiters.js";

export type ApiRouteDefinition = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  handlers: RequestHandler[];
};

const privilegedRoles = ["CONSILIER", "SECRETAR", "VICEPRESEDINTE", "PRESEDINTE"] as const;

const newsAdminRoleGuard = requireRole(...privilegedRoles);
const newsMediaRoleGuard = requireRole(...privilegedRoles);
const adminRoleGuard = requireRole(...privilegedRoles);

const liveHealthHandler: RequestHandler = (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  sendSuccess(res, buildLivenessPayload());
};

const readinessHandler: RequestHandler = async (_req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const report = await buildReadinessReport();
    sendSuccess(res, report, {
      status: report.ready ? 200 : 503,
    });
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

const apiRouteDefinitions: ApiRouteDefinition[] = [
  { method: "GET", url: "/api/health/live", handlers: [liveHealthHandler] },
  { method: "GET", url: "/api/health/ready", handlers: [readinessHandler] },
  { method: "GET", url: "/api/health", handlers: [readinessHandler] },

  { method: "GET", url: "/api/news", handlers: [listPublicNews] },
  { method: "GET", url: "/api/news/:id", handlers: [getPublicNewsById] },
  { method: "GET", url: "/api/news/admin/list", handlers: [requireAuth, newsAdminRoleGuard, listAdminNews] },
  { method: "GET", url: "/api/news/admin/:id", handlers: [requireAuth, newsAdminRoleGuard, getAdminNewsById] },
  { method: "POST", url: "/api/news", handlers: [requireAuth, newsAdminRoleGuard, createAdminNews] },
  { method: "PUT", url: "/api/news/:id", handlers: [requireAuth, newsAdminRoleGuard, updateAdminNews] },
  { method: "DELETE", url: "/api/news/:id", handlers: [requireAuth, newsAdminRoleGuard, deleteAdminNews] },
  { method: "GET", url: "/api/news/media/library", handlers: [requireAuth, newsMediaRoleGuard, listMediaLibrary] },
  { method: "POST", url: "/api/news/media/upload", handlers: [requireAuth, newsMediaRoleGuard, uploadMedia] },
  { method: "DELETE", url: "/api/news/media/library/:assetId", handlers: [requireAuth, newsMediaRoleGuard, deleteMediaAsset] },

  { method: "GET", url: "/api/stats", handlers: [listStatsHandler] },
  { method: "GET", url: "/api/volunteers", handlers: [listPublicVolunteersHandler] },
  { method: "GET", url: "/api/volunteers/counties", handlers: [listVolunteerCountiesHandler] },
  { method: "GET", url: "/api/meta/counties", handlers: [listVolunteerCountiesHandler] },
  { method: "GET", url: "/api/volunteers/by-county", handlers: [listVolunteersByCountyHandler] },
  { method: "POST", url: "/api/volunteers", handlers: [volunteersRateLimiter, createVolunteerHandler] },
  { method: "GET", url: "/api/members", handlers: [requireAuth, adminRoleGuard, listMembersController] },
  { method: "GET", url: "/api/organizations", handlers: [listOrganizationsController] },
  { method: "GET", url: "/api/finance", handlers: [listFinanceController] },
  { method: "GET", url: "/api/elections", handlers: [listElectionsController] },

  { method: "POST", url: "/api/auth/signup", handlers: [signupRateLimiter, signupAccountRateLimiter, signupHandler] },
  { method: "POST", url: "/api/auth/signin", handlers: [signinRateLimiter, signinAccountRateLimiter, signinHandler] },
  { method: "POST", url: "/api/auth/refresh", handlers: [refreshRateLimiter, refreshHandler] },
  { method: "POST", url: "/api/auth/signout", handlers: [handleSignout] },
  { method: "POST", url: "/api/auth/logout", handlers: [handleSignout] },
  { method: "POST", url: "/api/auth/revoke-all", handlers: [requireAuth, revokeAllSessionsHandler] },
  { method: "GET", url: "/api/auth/policy", handlers: [policyHandler] },
  { method: "GET", url: "/api/auth/me", handlers: [requireAuth, meHandler] },

  { method: "GET", url: "/api/admin/volunteers", handlers: [requireAuth, adminRoleGuard, listAdminVolunteersHandler] },
  { method: "GET", url: "/api/admin/volunteers/owners", handlers: [requireAuth, adminRoleGuard, listAdminVolunteerOwnersHandler] },
  { method: "GET", url: "/api/admin/volunteers/export.csv", handlers: [requireAuth, adminRoleGuard, exportAdminVolunteersCsvHandler] },
  { method: "DELETE", url: "/api/admin/volunteers/bulk", handlers: [requireAuth, adminRoleGuard, bulkDeleteAdminVolunteerHandler] },
  { method: "PATCH", url: "/api/admin/volunteers/workflow/bulk", handlers: [requireAuth, adminRoleGuard, bulkUpdateAdminVolunteerWorkflowHandler] },
  { method: "GET", url: "/api/admin/volunteers/:id", handlers: [requireAuth, adminRoleGuard, getAdminVolunteerByIdHandler] },
  { method: "PATCH", url: "/api/admin/volunteers/:id/workflow", handlers: [requireAuth, adminRoleGuard, updateAdminVolunteerWorkflowHandler] },
  { method: "DELETE", url: "/api/admin/volunteers/:id", handlers: [requireAuth, adminRoleGuard, deleteAdminVolunteerHandler] },
  { method: "GET", url: "/api/admin/members/dashboard", handlers: [requireAuth, adminRoleGuard, listAdminMembersDashboardController] },
  { method: "POST", url: "/api/admin/notifications/email-test", handlers: [requireAuth, adminRoleGuard, sendAdminEmailTestHandler] },
  { method: "GET", url: "/api/admin/audit", handlers: [requireAuth, adminRoleGuard, listAdminAuditHandler] },
];

export function getApiRouteDefinitions(): ApiRouteDefinition[] {
  if (!env.metricsEnabled) {
    return apiRouteDefinitions;
  }

  return [
    ...apiRouteDefinitions.slice(0, 3),
    { method: "GET", url: "/api/metrics", handlers: [metricsHandler] },
    ...apiRouteDefinitions.slice(3),
  ];
}
