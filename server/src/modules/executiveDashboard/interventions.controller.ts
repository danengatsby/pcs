import type { RequestHandler } from "express";
import { requireAdminAccess } from "../../lib/adminAuthorization.js";
import { recordAdminAudit } from "../../lib/adminAudit.js";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import { readExecutiveInterventions } from "./interventions.repository.js";
import { listExpiryRecords, updateExpiryRecord } from "./expirations.repository.js";
import { expiryParamsSchema, expiryQuerySchema, expiryUpdateSchema, interventionQuerySchema } from "./interventions.schema.js";

export const listInterventionsController: RequestHandler = async (req, res, next) => {
  try {
    const parsed = interventionQuerySchema.safeParse(req.query);
    if (!parsed.success) { throw new AppError(400, "BAD_REQUEST", "Filtre de intervenții invalide."); }
    res.setHeader("Cache-Control", "private, no-store");
    sendSuccess(res, await readExecutiveInterventions(requireAdminAccess(res), parsed.data));
  } catch (error) { next(error); }
};
export const listExpirationsController: RequestHandler = async (req, res, next) => {
  try {
    const parsed = expiryQuerySchema.safeParse(req.query);
    if (!parsed.success) { throw new AppError(400, "BAD_REQUEST", "Filtre de termene invalide."); }
    const access = requireAdminAccess(res);
    res.setHeader("Cache-Control", "private, no-store");
    sendSuccess(res, { ...await listExpiryRecords(access, parsed.data), canManage: access.capabilities.includes("executive.targets") });
  } catch (error) { next(error); }
};
export const updateExpirationController: RequestHandler = async (req, res, next) => {
  try {
    const params = expiryParamsSchema.safeParse(req.params);
    const payload = expiryUpdateSchema.safeParse(req.body);
    if (!params.success || !payload.success) { throw new AppError(400, "BAD_REQUEST", "Trimite un termen calendaristic valid și termenul anterior."); }
    const access = requireAdminAccess(res);
    const { source, id } = params.data;
    const visible = await listExpiryRecords(access, { record: `${source}:${id}`, limit: 1, offset: 0 });
    if (visible.total !== 1) { throw new AppError(404, "NOT_FOUND", "Înregistrarea nu este disponibilă în aria autorizată."); }
    const updated = await updateExpiryRecord(source, id, payload.data.expiresOn, payload.data.expectedExpiresOn);
    if (!updated) { throw new AppError(409, "EXECUTIVE_EXPIRATION_CONFLICT", "Termenul a fost modificat între timp. Reîncarcă lista."); }
    await recordAdminAudit({ actor: access.actor, action: "executive.expiration.update", targetType: source, targetId: id,
      details: { previousExpiresOn: payload.data.expectedExpiresOn, expiresOn: payload.data.expiresOn } });
    sendSuccess(res, { source, id, expiresOn: payload.data.expiresOn });
  } catch (error) { next(error); }
};
