import type { RequestHandler } from "express";
import { requireAdminCapability, requireAuth } from "../lib/authMiddleware.js";
import { requireAdminAccess, territoryScopeLabel } from "../lib/adminAuthorization.js";
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
import {
  applyMembershipActionController,
  listAdminMembersDashboardController,
} from "../modules/members/adminDashboard.controller.js";
import {
  createAdminOrganizationController,
  createAdminOrganizationMandateController,
  createAdminOrganizationObjectiveController,
  getAdminOrganizationController,
  listAdminOrganizationsController,
  listOrganizationsController,
  updateAdminOrganizationController,
  updateAdminOrganizationMandateController,
  updateAdminOrganizationObjectiveController,
} from "../modules/organizations/organizations.controller.js";
import { listFinanceController } from "../modules/finance/finance.controller.js";
import { listElectionsController } from "../modules/elections/elections.controller.js";
import {
  getExecutiveDashboardController,
  updateExecutiveTargetController,
} from "../modules/executiveDashboard/executiveDashboard.controller.js";
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
import {
  createMobilizationResponseController,
  listMobilizationActionsController,
} from "../modules/mobilization/mobilization.controller.js";
import { mobilizationRateLimiter } from "../modules/mobilization/mobilization.rateLimit.js";
import {
  addPoliticalParticipantController,
  createPoliticalOperationController,
  listPoliticalOperationsController,
  updatePoliticalOperationController,
  updatePoliticalParticipantController,
} from "../modules/politicalOperations/politicalOperations.controller.js";
import {
  createCommunicationDispatchController,
  previewCommunicationAudienceController,
} from "../modules/communications/communications.controller.js";
import {
  readMemberPortalController,
  updateMemberConsentController,
  updateMemberEventResponseController,
  updateMemberTaskReportController,
} from "../modules/memberPortal/memberPortal.controller.js";

export type ApiRouteDefinition = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  handlers: RequestHandler[];
};

const recruitmentReadGuard = requireAdminCapability("recruitment.read");
const recruitmentExportGuard = requireAdminCapability("recruitment.export");
const recruitmentManageGuard = requireAdminCapability("recruitment.manage");
const recruitmentDeleteGuard = requireAdminCapability("recruitment.delete");
const membershipReadGuard = requireAdminCapability("membership.read");
const membershipWriteGuard = requireAdminCapability("membership.validate");
const organizationReadGuard = requireAdminCapability("organization.read");
const organizationCreateGuard = requireAdminCapability("organization.create");
const organizationUpdateGuard = requireAdminCapability("organization.update");
const organizationMandateGuard = requireAdminCapability("organization.mandate");
const organizationObjectiveGuard = requireAdminCapability("organization.objective");
const executiveReadGuard = requireAdminCapability("executive.read");
const executiveTargetGuard = requireAdminCapability("executive.targets");
const mobilizationReadGuard = requireAdminCapability("mobilization.read");
const mobilizationManageGuard = requireAdminCapability("mobilization.manage");
const communicationPreviewGuard = requireAdminCapability("communication.preview");
const newsReadGuard = requireAdminCapability("content.read");
const newsWriteGuard = requireAdminCapability("content.write");
const auditReadGuard = requireAdminCapability("audit.read");
const notificationTestGuard = requireAdminCapability("notifications.test");

const adminAccessHandler: RequestHandler = (_req, res, next) => {
  try {
    const access = requireAdminAccess(res);
    sendSuccess(res, {
      role: access.actor.role,
      capabilities: access.capabilities,
      scope: {
        national: access.scope.national,
        label: territoryScopeLabel(access.scope),
        mandateOrganizationIds: access.scope.mandateOrganizationIds,
        organizationIds: access.scope.organizationIds,
        counties: access.scope.countyNames,
        localities: access.scope.localities.map((item) => ({
          county: item.countyName,
          locality: item.locality,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

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
  { method: "GET", url: "/api/news/admin/list", handlers: [requireAuth, newsReadGuard, listAdminNews] },
  { method: "GET", url: "/api/news/admin/:id", handlers: [requireAuth, newsReadGuard, getAdminNewsById] },
  { method: "POST", url: "/api/news", handlers: [requireAuth, newsWriteGuard, createAdminNews] },
  { method: "PUT", url: "/api/news/:id", handlers: [requireAuth, newsWriteGuard, updateAdminNews] },
  { method: "DELETE", url: "/api/news/:id", handlers: [requireAuth, newsWriteGuard, deleteAdminNews] },
  { method: "GET", url: "/api/news/media/library", handlers: [requireAuth, newsReadGuard, listMediaLibrary] },
  { method: "POST", url: "/api/news/media/upload", handlers: [requireAuth, newsWriteGuard, uploadMedia] },
  { method: "DELETE", url: "/api/news/media/library/:assetId", handlers: [requireAuth, newsWriteGuard, deleteMediaAsset] },

  { method: "GET", url: "/api/stats", handlers: [listStatsHandler] },
  { method: "GET", url: "/api/volunteers", handlers: [listPublicVolunteersHandler] },
  { method: "GET", url: "/api/volunteers/counties", handlers: [listVolunteerCountiesHandler] },
  { method: "GET", url: "/api/meta/counties", handlers: [listVolunteerCountiesHandler] },
  { method: "GET", url: "/api/volunteers/by-county", handlers: [listVolunteersByCountyHandler] },
  { method: "POST", url: "/api/volunteers", handlers: [volunteersRateLimiter, createVolunteerHandler] },
  { method: "GET", url: "/api/mobilization/actions", handlers: [listMobilizationActionsController] },
  {
    method: "POST",
    url: "/api/mobilization/actions/:slug/responses",
    handlers: [mobilizationRateLimiter, createMobilizationResponseController],
  },
  { method: "GET", url: "/api/members", handlers: [requireAuth, membershipReadGuard, listMembersController] },
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

  { method: "GET", url: "/api/member-portal", handlers: [requireAuth, readMemberPortalController] },
  { method: "POST", url: "/api/member-portal/events/:id/response", handlers: [requireAuth, updateMemberEventResponseController] },
  { method: "PATCH", url: "/api/member-portal/tasks/:id", handlers: [requireAuth, updateMemberTaskReportController] },
  { method: "PATCH", url: "/api/member-portal/consents", handlers: [requireAuth, updateMemberConsentController] },

  { method: "GET", url: "/api/admin/access", handlers: [requireAuth, recruitmentReadGuard, adminAccessHandler] },
  { method: "GET", url: "/api/admin/volunteers", handlers: [requireAuth, recruitmentReadGuard, listAdminVolunteersHandler] },
  { method: "GET", url: "/api/admin/volunteers/owners", handlers: [requireAuth, recruitmentReadGuard, listAdminVolunteerOwnersHandler] },
  { method: "GET", url: "/api/admin/volunteers/export.csv", handlers: [requireAuth, recruitmentExportGuard, exportAdminVolunteersCsvHandler] },
  { method: "DELETE", url: "/api/admin/volunteers/bulk", handlers: [requireAuth, recruitmentDeleteGuard, bulkDeleteAdminVolunteerHandler] },
  { method: "PATCH", url: "/api/admin/volunteers/workflow/bulk", handlers: [requireAuth, recruitmentManageGuard, bulkUpdateAdminVolunteerWorkflowHandler] },
  { method: "GET", url: "/api/admin/volunteers/:id", handlers: [requireAuth, recruitmentReadGuard, getAdminVolunteerByIdHandler] },
  { method: "PATCH", url: "/api/admin/volunteers/:id/workflow", handlers: [requireAuth, recruitmentManageGuard, updateAdminVolunteerWorkflowHandler] },
  { method: "DELETE", url: "/api/admin/volunteers/:id", handlers: [requireAuth, recruitmentDeleteGuard, deleteAdminVolunteerHandler] },
  { method: "GET", url: "/api/admin/members/dashboard", handlers: [requireAuth, membershipReadGuard, listAdminMembersDashboardController] },
  { method: "POST", url: "/api/admin/members/:id/actions", handlers: [requireAuth, membershipWriteGuard, applyMembershipActionController] },
  { method: "GET", url: "/api/admin/executive-dashboard", handlers: [requireAuth, executiveReadGuard, getExecutiveDashboardController] },
  { method: "PATCH", url: "/api/admin/executive-dashboard/targets/:key", handlers: [requireAuth, executiveTargetGuard, updateExecutiveTargetController] },
  { method: "GET", url: "/api/admin/mobilization", handlers: [requireAuth, mobilizationReadGuard, listPoliticalOperationsController] },
  { method: "POST", url: "/api/admin/mobilization/actions", handlers: [requireAuth, mobilizationManageGuard, createPoliticalOperationController] },
  { method: "PATCH", url: "/api/admin/mobilization/actions/:id", handlers: [requireAuth, mobilizationManageGuard, updatePoliticalOperationController] },
  { method: "POST", url: "/api/admin/mobilization/actions/:id/participants", handlers: [requireAuth, mobilizationManageGuard, addPoliticalParticipantController] },
  { method: "PATCH", url: "/api/admin/mobilization/participants/:id", handlers: [requireAuth, mobilizationManageGuard, updatePoliticalParticipantController] },
  { method: "POST", url: "/api/admin/communications/preview", handlers: [requireAuth, communicationPreviewGuard, previewCommunicationAudienceController] },
  { method: "POST", url: "/api/admin/communications/dispatches", handlers: [requireAuth, communicationPreviewGuard, createCommunicationDispatchController] },
  { method: "GET", url: "/api/admin/organizations", handlers: [requireAuth, organizationReadGuard, listAdminOrganizationsController] },
  { method: "POST", url: "/api/admin/organizations", handlers: [requireAuth, organizationCreateGuard, createAdminOrganizationController] },
  { method: "GET", url: "/api/admin/organizations/:id", handlers: [requireAuth, organizationReadGuard, getAdminOrganizationController] },
  { method: "PATCH", url: "/api/admin/organizations/:id", handlers: [requireAuth, organizationUpdateGuard, updateAdminOrganizationController] },
  { method: "POST", url: "/api/admin/organizations/:id/mandates", handlers: [requireAuth, organizationMandateGuard, createAdminOrganizationMandateController] },
  { method: "PATCH", url: "/api/admin/organizations/:id/mandates/:childId", handlers: [requireAuth, organizationMandateGuard, updateAdminOrganizationMandateController] },
  { method: "POST", url: "/api/admin/organizations/:id/objectives", handlers: [requireAuth, organizationObjectiveGuard, createAdminOrganizationObjectiveController] },
  { method: "PATCH", url: "/api/admin/organizations/:id/objectives/:childId", handlers: [requireAuth, organizationObjectiveGuard, updateAdminOrganizationObjectiveController] },
  { method: "POST", url: "/api/admin/notifications/email-test", handlers: [requireAuth, notificationTestGuard, sendAdminEmailTestHandler] },
  { method: "GET", url: "/api/admin/audit", handlers: [requireAuth, auditReadGuard, listAdminAuditHandler] },
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
