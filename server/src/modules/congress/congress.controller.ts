import type { RequestHandler } from "express";
import { requireAdminAccess } from "../../lib/adminAuthorization.js";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import { candidacySchema, createCongressSchema, castVoteSchema, delegateSchema } from "./congress.schema.js";
import { addCandidacyService, addDelegateService, castVoteService, checkInDelegateService, createCongressService, listCongressService, readCongressResultsService, transitionCongressService, validateCandidacyService } from "./congress.service.js";

function parse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(400, "CONGRESS_INVALID", result.error.issues[0]?.message ?? "Datele congresului sunt invalide.");
  }
  return result.data;
}

export const listCongressController: RequestHandler = async (_req, res, next) => { try { sendSuccess(res, await listCongressService(requireAdminAccess(res))); } catch (error) { next(error); } };
export const createCongressController: RequestHandler = async (req, res, next) => { try { sendSuccess(res, await createCongressService(parse(createCongressSchema, req.body), requireAdminAccess(res)), { status: 201 }); } catch (error) { next(error); } };
export const addCongressDelegateController: RequestHandler = async (req, res, next) => { try { const access = requireAdminAccess(res); sendSuccess(res, await addDelegateService(String(req.params.id), parse(delegateSchema, req.body), access), { status: 201 }); } catch (error) { next(error); } };
export const addCongressCandidacyController: RequestHandler = async (req, res, next) => { try { const access = requireAdminAccess(res); sendSuccess(res, await addCandidacyService(String(req.params.id), parse(candidacySchema, req.body), access), { status: 201 }); } catch (error) { next(error); } };
export const validateCongressCandidacyController: RequestHandler = async (req, res, next) => { try { sendSuccess(res, await validateCandidacyService(String(req.params.id), String(req.params.candidacyId), requireAdminAccess(res))); } catch (error) { next(error); } };
export const transitionCongressController: RequestHandler = async (req, res, next) => { try { const status = parseStatus(req.body?.status); sendSuccess(res, await transitionCongressService(String(req.params.id), status, requireAdminAccess(res))); } catch (error) { next(error); } };
export const checkInCongressDelegateController: RequestHandler = async (req, res, next) => { try { sendSuccess(res, await checkInDelegateService(String(req.params.id), String(req.params.delegateId), requireAdminAccess(res))); } catch (error) { next(error); } };
export const castCongressVoteController: RequestHandler = async (req, res, next) => { try { sendSuccess(res, await castVoteService(String(req.params.id), parse(castVoteSchema, req.body), requireAdminAccess(res))); } catch (error) { next(error); } };
export const congressResultsController: RequestHandler = async (req, res, next) => { try { sendSuccess(res, await readCongressResultsService(String(req.params.id))); } catch (error) { next(error); } };

function parseStatus(value: unknown): "open" | "closed" | "validated" {
  if (value === "open" || value === "closed" || value === "validated") {
    return value;
  }
  throw new AppError(400, "CONGRESS_INVALID", "Stare invalidă.");
}