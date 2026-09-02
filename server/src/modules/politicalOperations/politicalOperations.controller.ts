import type { RequestHandler } from "express";
import { requireAdminAccess } from "../../lib/adminAuthorization.js";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import {
  addPoliticalParticipantSchema,
  createPoliticalOperationSchema,
  politicalOperationIdSchema,
  politicalOperationsQuerySchema,
  politicalParticipantIdSchema,
  updatePoliticalOperationSchema,
  updatePoliticalParticipantSchema,
} from "./politicalOperations.schema.js";
import {
  addPoliticalParticipantService,
  createPoliticalOperationService,
  listPoliticalOperationsService,
  updatePoliticalOperationService,
  updatePoliticalParticipantService,
} from "./politicalOperations.service.js";

function invalid(message: string): AppError {
  return new AppError(400, "POLITICAL_OPERATION_INVALID", message);
}

export const listPoliticalOperationsController: RequestHandler = async (req, res, next) => {
  const parsed = politicalOperationsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(invalid(parsed.error.issues[0]?.message ?? "Filtre invalide."));
    return;
  }
  try {
    sendSuccess(res, await listPoliticalOperationsService(parsed.data, requireAdminAccess(res)));
  } catch (error) {
    next(error);
  }
};

export const createPoliticalOperationController: RequestHandler = async (req, res, next) => {
  const parsed = createPoliticalOperationSchema.safeParse(req.body);
  if (!parsed.success) {
    next(invalid(parsed.error.issues[0]?.message ?? "Datele acțiunii sunt invalide."));
    return;
  }
  try {
    sendSuccess(res, await createPoliticalOperationService({ payload: parsed.data, access: requireAdminAccess(res) }), { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updatePoliticalOperationController: RequestHandler = async (req, res, next) => {
  const params = politicalOperationIdSchema.safeParse(req.params);
  const payload = updatePoliticalOperationSchema.safeParse(req.body);
  if (!params.success || !payload.success) {
    next(invalid(params.error?.issues[0]?.message ?? payload.error?.issues[0]?.message ?? "Actualizare invalidă."));
    return;
  }
  try {
    sendSuccess(res, await updatePoliticalOperationService({
      operationId: params.data.id,
      payload: payload.data,
      access: requireAdminAccess(res),
    }));
  } catch (error) {
    next(error);
  }
};

export const addPoliticalParticipantController: RequestHandler = async (req, res, next) => {
  const params = politicalOperationIdSchema.safeParse(req.params);
  const payload = addPoliticalParticipantSchema.safeParse(req.body);
  if (!params.success || !payload.success) {
    next(invalid(params.error?.issues[0]?.message ?? payload.error?.issues[0]?.message ?? "Participant invalid."));
    return;
  }
  try {
    sendSuccess(res, await addPoliticalParticipantService({
      operationId: params.data.id,
      payload: payload.data,
      access: requireAdminAccess(res),
    }), { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updatePoliticalParticipantController: RequestHandler = async (req, res, next) => {
  const params = politicalParticipantIdSchema.safeParse(req.params);
  const payload = updatePoliticalParticipantSchema.safeParse(req.body);
  if (!params.success || !payload.success) {
    next(invalid(params.error?.issues[0]?.message ?? payload.error?.issues[0]?.message ?? "Raportare invalidă."));
    return;
  }
  try {
    sendSuccess(res, await updatePoliticalParticipantService({
      participantId: params.data.id,
      payload: payload.data,
      access: requireAdminAccess(res),
    }));
  } catch (error) {
    next(error);
  }
};
