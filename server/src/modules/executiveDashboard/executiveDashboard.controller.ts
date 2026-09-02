import type { RequestHandler } from "express";
import { recordAdminAudit } from "../../lib/adminAudit.js";
import { readAuthUser } from "../../lib/authMiddleware.js";
import { requireAdminAccess, territoryScopeLabel } from "../../lib/adminAuthorization.js";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/http.js";
import {
  executiveTargetKeySchema,
  updateExecutiveTargetSchema,
} from "./executiveDashboard.schema.js";
import {
  getExecutiveDashboardService,
  updateExecutiveTargetService,
} from "./executiveDashboard.service.js";

export const getExecutiveDashboardController: RequestHandler = async (_req, res, next) => {
  try {
    const access = requireAdminAccess(res);
    sendSuccess(res, {
      ...await getExecutiveDashboardService(access.scope),
      access: {
        scope: territoryScopeLabel(access.scope),
        national: access.scope.national,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateExecutiveTargetController: RequestHandler = async (req, res, next) => {
  const parsedKey = executiveTargetKeySchema.safeParse(req.params.key);
  const parsedBody = updateExecutiveTargetSchema.safeParse(req.body);

  if (!parsedKey.success) {
    next(new AppError(
      400,
      "EXECUTIVE_TARGET_INVALID",
      parsedKey.error.issues[0]?.message ?? "Țintă executivă invalidă."
    ));
    return;
  }

  if (!parsedBody.success) {
    next(new AppError(
      400,
      "EXECUTIVE_TARGET_INVALID",
      parsedBody.error.issues[0]?.message ?? "Țintă executivă invalidă."
    ));
    return;
  }

  const authUser = readAuthUser(res);
  if (!authUser) {
    next(new AppError(401, "AUTH_UNAUTHORIZED", "Autentificare necesară."));
    return;
  }

  try {
    const result = await updateExecutiveTargetService({
      key: parsedKey.data,
      payload: parsedBody.data,
      updatedBy: BigInt(authUser.id),
    });

    if (!result) {
      next(new AppError(404, "EXECUTIVE_TARGET_NOT_FOUND", "Ținta executivă nu a fost găsită."));
      return;
    }

    await recordAdminAudit({
      actor: {
        userId: authUser.id,
        email: authUser.email,
        role: authUser.role,
      },
      action: "executive_target.update",
      targetType: "executive_target",
      targetId: result.target.key,
      details: {
        previousTargetValue: result.previousTargetValue,
        nextTargetValue: result.target.targetValue,
      },
    });

    sendSuccess(res, {
      message: "Ținta executivă a fost actualizată.",
      target: result.target,
    });
  } catch (error) {
    next(error);
  }
};
