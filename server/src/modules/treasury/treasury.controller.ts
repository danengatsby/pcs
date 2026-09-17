import type { RequestHandler } from "express";
import { requireAdminAccess } from "../../lib/adminAuthorization.js";
import { sendSuccess } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { parseRecord, recordHistory, recordIdSchema } from "../admin/workspaceRecords.js";
import { createTreasurySchema, listTreasurySchema, postTreasurySchema, updateTreasurySchema, voidTreasurySchema } from "./treasury.schema.js";
import { changeTreasury, createTreasury, listTreasury } from "./treasury.service.js";

export const listTreasuryHandler: RequestHandler = async (req, res, next) => { try {
  res.setHeader("Cache-Control", "private, no-store");
  sendSuccess(res, await listTreasury(parseRecord(listTreasurySchema, req.query)));
} catch (error) { next(error); } };
export const createTreasuryHandler: RequestHandler = async (req, res, next) => { try {
  sendSuccess(res, await createTreasury(parseRecord(createTreasurySchema, req.body), requireAdminAccess(res)), { status: 201 });
} catch (error) { next(error); } };
export const updateTreasuryHandler: RequestHandler = async (req, res, next) => { try {
  const { id } = parseRecord(recordIdSchema, req.params);
  const { version, ...fields } = parseRecord(updateTreasurySchema, req.body);
  sendSuccess(res, await changeTreasury(id, version, requireAdminAccess(res), { action: "update", fields }));
} catch (error) { next(error); } };
export const postTreasuryHandler: RequestHandler = async (req, res, next) => { try {
  const { id } = parseRecord(recordIdSchema, req.params);
  const { version } = parseRecord(postTreasurySchema, req.body);
  sendSuccess(res, await changeTreasury(id, version, requireAdminAccess(res), { action: "post" }));
} catch (error) { next(error); } };
export const voidTreasuryHandler: RequestHandler = async (req, res, next) => { try {
  const { id } = parseRecord(recordIdSchema, req.params);
  const { version, reason } = parseRecord(voidTreasurySchema, req.body);
  sendSuccess(res, await changeTreasury(id, version, requireAdminAccess(res), { action: "void", reason }));
} catch (error) { next(error); } };
export const treasuryHistoryHandler: RequestHandler = async (req, res, next) => { try {
  const { id } = parseRecord(recordIdSchema, req.params);
  if (!await prisma.treasuryEntry.findUnique({ where: { id }, select: { id: true } })) { throw new AppError(404, "ADMIN_RECORD_NOT_FOUND", "Înregistrarea nu există."); }
  res.setHeader("Cache-Control", "private, no-store");
  sendSuccess(res, await recordHistory("treasury_entry", id));
} catch (error) { next(error); } };
