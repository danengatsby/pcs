import type { RequestHandler } from "express";
import { readAuthUser } from "../../lib/authMiddleware.js";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import {
  memberConsentSchema,
  memberEventResponseSchema,
  memberPortalIdSchema,
  memberTaskReportSchema,
} from "./memberPortal.schema.js";
import {
  readMemberPortalService,
  updateMemberConsentService,
  updateMemberEventResponseService,
  updateMemberTaskReportService,
} from "./memberPortal.service.js";

function actorFromResponse(res: Parameters<RequestHandler>[1]) {
  const actor = readAuthUser(res);
  if (!actor) {throw new AppError(401, "AUTH_UNAUTHORIZED", "Autentificarea este obligatorie.");}
  return actor;
}

function invalid(message: string): AppError {
  return new AppError(400, "MEMBER_PORTAL_ACTION_FORBIDDEN", message);
}

export const readMemberPortalController: RequestHandler = async (_req, res, next) => {
  try { sendSuccess(res, await readMemberPortalService(actorFromResponse(res))); } catch (error) { next(error); }
};

export const updateMemberEventResponseController: RequestHandler = async (req, res, next) => {
  const params = memberPortalIdSchema.safeParse(req.params);
  const payload = memberEventResponseSchema.safeParse(req.body);
  if (!params.success || !payload.success) {
    next(invalid(params.error?.issues[0]?.message ?? payload.error?.issues[0]?.message ?? "Răspuns invalid."));
    return;
  }
  try { sendSuccess(res, await updateMemberEventResponseService(actorFromResponse(res), params.data.id, payload.data)); } catch (error) { next(error); }
};

export const updateMemberTaskReportController: RequestHandler = async (req, res, next) => {
  const params = memberPortalIdSchema.safeParse(req.params);
  const payload = memberTaskReportSchema.safeParse(req.body);
  if (!params.success || !payload.success) {
    next(invalid(params.error?.issues[0]?.message ?? payload.error?.issues[0]?.message ?? "Raport invalid."));
    return;
  }
  try { sendSuccess(res, await updateMemberTaskReportService(actorFromResponse(res), params.data.id, payload.data)); } catch (error) { next(error); }
};

export const updateMemberConsentController: RequestHandler = async (req, res, next) => {
  const payload = memberConsentSchema.safeParse(req.body);
  if (!payload.success) {
    next(invalid(payload.error.issues[0]?.message ?? "Preferințe invalide."));
    return;
  }
  try { sendSuccess(res, await updateMemberConsentService(actorFromResponse(res), payload.data)); } catch (error) { next(error); }
};
