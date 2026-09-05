import type { RequestHandler } from "express";
import { AppError, isDbError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import { sendMobilizationResponseConfirmationEmail } from "../../lib/notificationEmails.js";
import {
  mobilizationActionParamsSchema,
  mobilizationResponseSchema,
} from "./mobilization.schema.js";
import {
  createMobilizationResponse,
  listPublicMobilizationActions,
} from "./mobilization.repository.js";

export const listMobilizationActionsController: RequestHandler = async (_req, res, next) => {
  try {
    sendSuccess(res, await listPublicMobilizationActions());
  } catch (error) {
    next(error);
  }
};

export const createMobilizationResponseController: RequestHandler = async (req, res, next) => {
  const params = mobilizationActionParamsSchema.safeParse(req.params);
  const payload = mobilizationResponseSchema.safeParse(req.body);

  if (!params.success || !payload.success) {
    const message = !params.success
      ? "Acțiunea selectată este invalidă."
      : !payload.success
        ? payload.error.issues[0]?.message ?? "Date de participare invalide."
        : "Date de participare invalide.";
    next(new AppError(
      400,
      "MOBILIZATION_VALIDATION_FAILED",
      message,
    ));
    return;
  }

  if (payload.data.website) {
    sendSuccess(res, { accepted: true, id: null, registrationStatus: null }, { status: 202 });
    return;
  }

  try {
    const response = await createMobilizationResponse(params.data.slug, payload.data);
    if (!response) {
      throw new AppError(404, "MOBILIZATION_ACTION_NOT_FOUND", "Acțiunea nu este disponibilă pentru înscrieri.");
    }
    sendSuccess(res, { accepted: true, id: response.id, registrationStatus: response.registrationStatus }, { status: 201 });
    void sendMobilizationResponseConfirmationEmail({
      fullName: payload.data.fullName,
      email: payload.data.email,
      actionTitle: response.actionTitle,
      registrationStatus: response.registrationStatus,
      actionType: response.actionType,
      participationMode: response.participationMode,
      commitment: response.commitment,
      county: payload.data.county,
      interests: payload.data.interests,
      updatesConsent: payload.data.updatesConsent,
    });
  } catch (error) {
    if (isDbError(error) && error.code === "23505") {
      next(new AppError(
        409,
        "MOBILIZATION_RESPONSE_EXISTS",
        "Există deja un răspuns pentru această acțiune și adresă de email.",
      ));
      return;
    }
    next(error);
  }
};
