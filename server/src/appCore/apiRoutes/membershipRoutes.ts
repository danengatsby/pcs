import type { ApiRouteDefinition } from "../apiRouteTypes.js";
import { requireAdminCapability, requireAuth } from "../../lib/authMiddleware.js";
import { listMembersController } from "../../modules/members/members.controller.js";
import {
  applyMembershipActionController,
  listAdminMembersDashboardController,
} from "../../modules/members/adminDashboard.controller.js";

const membershipReadGuard = requireAdminCapability("membership.read");
const membershipWriteGuard = requireAdminCapability("membership.validate");

export const membershipRoutes: ApiRouteDefinition[] = [
  { method: "GET", url: "/api/members", handlers: [requireAuth, membershipReadGuard, listMembersController] },
  { method: "GET", url: "/api/admin/members/dashboard", handlers: [requireAuth, membershipReadGuard, listAdminMembersDashboardController] },
  { method: "POST", url: "/api/admin/members/:id/actions", handlers: [requireAuth, membershipWriteGuard, applyMembershipActionController] },
];
