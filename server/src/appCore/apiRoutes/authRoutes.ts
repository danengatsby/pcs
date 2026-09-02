import type { ApiRouteDefinition } from "../apiRouteTypes.js";
import { requireAuth } from "../../lib/authMiddleware.js";
import {
  handleSignout,
  meHandler,
  policyHandler,
  refreshHandler,
  revokeAllSessionsHandler,
  signinHandler,
  signupHandler,
} from "../../modules/auth/handlers/index.js";
import {
  refreshRateLimiter,
  signinAccountRateLimiter,
  signinRateLimiter,
  signupAccountRateLimiter,
  signupRateLimiter,
} from "../../modules/auth/rateLimiters.js";
import {
  readMemberPortalController,
  updateMemberConsentController,
  updateMemberEventResponseController,
  updateMemberTaskReportController,
} from "../../modules/memberPortal/memberPortal.controller.js";

export const authRoutes: ApiRouteDefinition[] = [
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
];
