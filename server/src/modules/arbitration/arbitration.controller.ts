import type { RequestHandler } from "express";
import { requireAdminAccess } from "../../lib/adminAuthorization.js";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import { appealSchema, caseIdSchema, conflictSchema, createCaseSchema, decisionSchema, evidenceSchema, partySchema } from "./arbitration.schema.js";
import { addArbitrationEvidenceService, addArbitrationPartyService, appealArbitrationCaseService, createArbitrationCaseService, declareArbitrationConflictService, decideArbitrationCaseService, listArbitrationCasesService } from "./arbitration.service.js";

function parse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } } }, value: unknown): T { const result = schema.safeParse(value); if (!result.success) {throw new AppError(400, "ARBITRATION_INVALID", result.error.issues[0]?.message ?? "Date arbitrale sunt invalide.");} return result.data; }
function caseId(value: unknown): string { return String(parse(caseIdSchema, { id: value }).id); }
export const listArbitrationCasesController: RequestHandler = async (_req, res, next) => { try { sendSuccess(res, await listArbitrationCasesService(requireAdminAccess(res))); } catch (error) { next(error); } };
export const createArbitrationCaseController: RequestHandler = async (req, res, next) => { try { sendSuccess(res, await createArbitrationCaseService(parse(createCaseSchema, req.body), requireAdminAccess(res)), { status: 201 }); } catch (error) { next(error); } };
export const addArbitrationPartyController: RequestHandler = async (req, res, next) => { try { sendSuccess(res, await addArbitrationPartyService(caseId(req.params.id), parse(partySchema, req.body), requireAdminAccess(res)), { status: 201 }); } catch (error) { next(error); } };
export const addArbitrationEvidenceController: RequestHandler = async (req, res, next) => { try { sendSuccess(res, await addArbitrationEvidenceService(caseId(req.params.id), parse(evidenceSchema, req.body), requireAdminAccess(res)), { status: 201 }); } catch (error) { next(error); } };
export const declareArbitrationConflictController: RequestHandler = async (req, res, next) => { try { sendSuccess(res, await declareArbitrationConflictService(caseId(req.params.id), parse(conflictSchema, req.body), requireAdminAccess(res)), { status: 201 }); } catch (error) { next(error); } };
export const decideArbitrationCaseController: RequestHandler = async (req, res, next) => { try { sendSuccess(res, await decideArbitrationCaseService(caseId(req.params.id), parse(decisionSchema, req.body), requireAdminAccess(res))); } catch (error) { next(error); } };
export const appealArbitrationCaseController: RequestHandler = async (req, res, next) => { try { sendSuccess(res, await appealArbitrationCaseService(caseId(req.params.id), parse(appealSchema, req.body), requireAdminAccess(res)), { status: 201 }); } catch (error) { next(error); } };