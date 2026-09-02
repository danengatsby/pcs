import type { RequestHandler } from "express";
import { requireAdminAccess } from "../../lib/adminAuthorization.js";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import {
  communicationAudienceSchema,
  createCommunicationDispatchSchema,
} from "./communications.schema.js";
import {
  createCommunicationDispatchService,
  previewCommunicationAudienceService,
} from "./communications.service.js";

function invalid(message: string): AppError {
  return new AppError(400, "COMMUNICATION_AUDIENCE_INVALID", message);
}

export const previewCommunicationAudienceController: RequestHandler = async (req, res, next) => {
  const parsed = communicationAudienceSchema.safeParse(req.body);
  if (!parsed.success) {
    next(invalid(parsed.error.issues[0]?.message ?? "Segmentul este invalid."));
    return;
  }
  try {
    sendSuccess(res, await previewCommunicationAudienceService(parsed.data, requireAdminAccess(res)));
  } catch (error) {
    next(error);
  }
};

export const createCommunicationDispatchController: RequestHandler = async (req, res, next) => {
  const parsed = createCommunicationDispatchSchema.safeParse(req.body);
  if (!parsed.success) {
    next(invalid(parsed.error.issues[0]?.message ?? "Comunicarea este invalidă."));
    return;
  }
  try {
    sendSuccess(res, await createCommunicationDispatchService({
      payload: parsed.data,
      access: requireAdminAccess(res),
    }), { status: 201 });
  } catch (error) {
    next(error);
  }
};
