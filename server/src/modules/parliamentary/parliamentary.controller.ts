import type { RequestHandler } from "express";
import { requireAdminAccess } from "../../lib/adminAuthorization.js";
import { sendSuccess } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { parseRecord, recordHistory, recordIdSchema } from "../admin/workspaceRecords.js";
import { createParliamentarySchema, listParliamentarySchema, transitionParliamentarySchema, updateParliamentarySchema } from "./parliamentary.schema.js";
import { changeParliamentary, createParliamentary, listParliamentary, parliamentaryAssignees } from "./parliamentary.service.js";

export const listParliamentaryHandler: RequestHandler = async (req, res, next) => { try {
  res.setHeader("Cache-Control", "private, no-store");
  sendSuccess(res, await listParliamentary(parseRecord(listParliamentarySchema, req.query)));
} catch (error) { next(error); } };
export const parliamentaryAssigneesHandler: RequestHandler = async (_req, res, next) => { try {
  res.setHeader("Cache-Control", "private, no-store");
  sendSuccess(res, await parliamentaryAssignees());
} catch (error) { next(error); } };
export const createParliamentaryHandler: RequestHandler = async (req, res, next) => { try {
  sendSuccess(res, await createParliamentary(parseRecord(createParliamentarySchema, req.body), requireAdminAccess(res)), { status: 201 });
} catch (error) { next(error); } };
export const updateParliamentaryHandler: RequestHandler = async (req, res, next) => { try {
  const { id } = parseRecord(recordIdSchema, req.params);
  const { version, ...fields } = parseRecord(updateParliamentarySchema, req.body);
  sendSuccess(res, await changeParliamentary(id, version, requireAdminAccess(res), { action: "update", fields }));
} catch (error) { next(error); } };
export const transitionParliamentaryHandler: RequestHandler = async (req, res, next) => { try {
  const { id } = parseRecord(recordIdSchema, req.params);
  const { version, status, reason } = parseRecord(transitionParliamentarySchema, req.body);
  sendSuccess(res, await changeParliamentary(id, version, requireAdminAccess(res), { action: "status", status, reason }));
} catch (error) { next(error); } };
export const parliamentaryHistoryHandler: RequestHandler = async (req, res, next) => { try {
  const { id } = parseRecord(recordIdSchema, req.params);
  if (!await prisma.parliamentaryItem.findUnique({ where: { id }, select: { id: true } })) { throw new AppError(404, "ADMIN_RECORD_NOT_FOUND", "Inițiativa nu există."); }
  res.setHeader("Cache-Control", "private, no-store");
  sendSuccess(res, await recordHistory("parliamentary_item", id));
} catch (error) { next(error); } };
