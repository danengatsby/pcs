import type { RequestHandler } from "express";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import { adminMembersDashboardQuerySchema } from "./adminDashboard.schema.js";
import { listAdminMembersDashboardService } from "./adminDashboard.service.js";

export const listAdminMembersDashboardController: RequestHandler = async (req, res, next) => {
  const parsed = adminMembersDashboardQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    next(new AppError(400, "MEMBERS_QUERY_INVALID", firstIssue?.message ?? "Parametri invalidi."));
    return;
  }

  try {
    const payload = await listAdminMembersDashboardService(parsed.data);
    sendSuccess(res, payload);
  } catch (error) {
    next(error);
  }
};
