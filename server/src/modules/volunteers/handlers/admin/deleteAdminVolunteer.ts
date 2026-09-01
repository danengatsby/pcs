import type { NextFunction, Request, Response } from "express";
import { readAuthUser } from "../../../../lib/authMiddleware.js";
import { recordAdminAudit } from "../../../../lib/adminAudit.js";
import { AppError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { parseVolunteerId } from "../../parsing.js";
import {
  deleteAdminVolunteer,
  readAdminVolunteerById,
} from "../../repository.js";

export async function deleteAdminVolunteerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const volunteerId = parseVolunteerId(req.params.id);
  if (!volunteerId) {
    next(new AppError(400, "VOLUNTEER_ID_INVALID", "ID voluntar invalid."));
    return;
  }

  try {
    const existing = await readAdminVolunteerById(volunteerId);
    if (!existing) {
      next(new AppError(404, "VOLUNTEER_NOT_FOUND", "Voluntarul nu a fost gasit."));
      return;
    }

    const deleted = await deleteAdminVolunteer(volunteerId);
    if (!deleted) {
      next(new AppError(404, "VOLUNTEER_NOT_FOUND", "Voluntarul nu a fost gasit."));
      return;
    }

    const authUser = readAuthUser(res);
    if (authUser) {
      await recordAdminAudit({
        actor: {
          userId: authUser.id,
          email: authUser.email,
          role: authUser.role,
        },
        action: "volunteer.delete",
        targetType: "volunteer",
        targetId: deleted.id,
        details: {
          fullName: deleted.fullName,
          email: deleted.email,
          county: deleted.county,
          locality: deleted.locality,
          workflowStatus: deleted.workflowStatus,
        },
      });
    }

    sendSuccess(res, {
      message: "Formularul de voluntar a fost șters.",
      id: deleted.id,
    });
  } catch (error) {
    next(error);
  }
}
