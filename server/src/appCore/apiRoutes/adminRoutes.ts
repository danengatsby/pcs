import type { RequestHandler } from "express";
import type { ApiRouteDefinition } from "../apiRouteTypes.js";
import { requireAdminCapability, requireAuth } from "../../lib/authMiddleware.js";
import { requireAdminAccess, territoryScopeLabel } from "../../lib/adminAuthorization.js";
import { sendSuccess } from "../../lib/http.js";
import { listAdminAuditHandler } from "../../modules/admin/handlers/listAdminAudit.js";
import { sendAdminEmailTestHandler } from "../../modules/admin/handlers/sendAdminEmailTest.js";
import {
  bulkDeleteAdminVolunteerHandler,
  bulkUpdateAdminVolunteerWorkflowHandler,
  deleteAdminVolunteerHandler,
  exportAdminVolunteersCsvHandler,
  getAdminVolunteerByIdHandler,
  listAdminVolunteerOwnersHandler,
  listAdminVolunteersHandler,
  updateAdminVolunteerWorkflowHandler,
} from "../../modules/volunteers/handlers/admin/index.js";
import {
  createAdminOrganizationController,
  createAdminOrganizationMandateController,
  createAdminOrganizationObjectiveController,
  getAdminOrganizationController,
  listAdminOrganizationsController,
  updateAdminOrganizationController,
  updateAdminOrganizationMandateController,
  updateAdminOrganizationObjectiveController,
} from "../../modules/organizations/organizations.controller.js";
import { getExecutiveDashboardController, updateExecutiveTargetController } from "../../modules/executiveDashboard/executiveDashboard.controller.js";
import {
  addPoliticalParticipantController,
  createPoliticalOperationController,
  listPoliticalOperationsController,
  updatePoliticalOperationController,
  updatePoliticalParticipantController,
} from "../../modules/politicalOperations/politicalOperations.controller.js";
import {
  createCommunicationDispatchController,
  previewCommunicationAudienceController,
} from "../../modules/communications/communications.controller.js";

const recruitmentReadGuard = requireAdminCapability("recruitment.read");
const recruitmentExportGuard = requireAdminCapability("recruitment.export");
const recruitmentManageGuard = requireAdminCapability("recruitment.manage");
const recruitmentDeleteGuard = requireAdminCapability("recruitment.delete");
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

export const adminRoutes: ApiRouteDefinition[] = [
  { method: "GET", url: "/api/admin/access", handlers: [requireAuth, recruitmentReadGuard, adminAccessHandler] },
  { method: "GET", url: "/api/admin/volunteers", handlers: [requireAuth, recruitmentReadGuard, listAdminVolunteersHandler] },
  { method: "GET", url: "/api/admin/volunteers/owners", handlers: [requireAuth, recruitmentReadGuard, listAdminVolunteerOwnersHandler] },
  { method: "GET", url: "/api/admin/volunteers/export.csv", handlers: [requireAuth, recruitmentExportGuard, exportAdminVolunteersCsvHandler] },
  { method: "DELETE", url: "/api/admin/volunteers/bulk", handlers: [requireAuth, recruitmentDeleteGuard, bulkDeleteAdminVolunteerHandler] },
  { method: "PATCH", url: "/api/admin/volunteers/workflow/bulk", handlers: [requireAuth, recruitmentManageGuard, bulkUpdateAdminVolunteerWorkflowHandler] },
  { method: "GET", url: "/api/admin/volunteers/:id", handlers: [requireAuth, recruitmentReadGuard, getAdminVolunteerByIdHandler] },
  { method: "PATCH", url: "/api/admin/volunteers/:id/workflow", handlers: [requireAuth, recruitmentManageGuard, updateAdminVolunteerWorkflowHandler] },
  { method: "DELETE", url: "/api/admin/volunteers/:id", handlers: [requireAuth, recruitmentDeleteGuard, deleteAdminVolunteerHandler] },
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