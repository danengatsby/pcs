import type { RequestHandler } from "express";
import { readAuthUser } from "../../lib/authMiddleware.js";
import { requireAdminAccess, territoryScopeLabel } from "../../lib/adminAuthorization.js";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import {
  adminMembersDashboardQuerySchema,
  membershipActionSchema,
} from "./adminDashboard.schema.js";
import {
  applyMembershipActionService,
  listAdminMembersDashboardService,
} from "./adminDashboard.service.js";

export const listAdminMembersDashboardController: RequestHandler = async (req, res, next) => {
  const parsed = adminMembersDashboardQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    next(new AppError(400, "MEMBERS_QUERY_INVALID", firstIssue?.message ?? "Parametri invalidi."));
    return;
  }

  try {
    const authUser = readAuthUser(res);
    if (!authUser) {
      next(new AppError(401, "AUTH_UNAUTHORIZED", "Autentificare necesară."));
      return;
    }
    const access = requireAdminAccess(res);
    const payload = await listAdminMembersDashboardService(parsed.data, access);
    sendSuccess(res, {
      ...payload,
      access: {
        capabilities: access.capabilities,
        scope: territoryScopeLabel(access.scope),
        national: access.scope.national,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const applyMembershipActionController: RequestHandler = async (req, res, next) => {
  const parsed = membershipActionSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    next(new AppError(
      400,
      "MEMBERSHIP_ACTION_INVALID",
      firstIssue?.message ?? "Decizia de membru este invalidă."
    ));
    return;
  }

  const authUser = readAuthUser(res);
  if (!authUser) {
    next(new AppError(401, "AUTH_UNAUTHORIZED", "Autentificare necesară."));
    return;
  }

  try {
    const membership = await applyMembershipActionService({
      membershipId: req.params.id ?? "",
      payload: parsed.data,
      access: requireAdminAccess(res),
    });
    sendSuccess(res, {
      message: "Decizia a fost înregistrată în istoricul membrului.",
      membership,
    });
  } catch (error) {
    next(error);
  }
};
