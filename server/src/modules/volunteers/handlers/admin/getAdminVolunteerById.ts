import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { parseAdminVolunteerRecordId } from "../../parsing.js";
import { readAdminVolunteerRecordById } from "../../repository.js";

export async function getAdminVolunteerByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const volunteerRecordId = parseAdminVolunteerRecordId(req.params.id);
  if (volunteerRecordId === null) {
    next(new AppError(400, "VOLUNTEER_ID_INVALID", "ID voluntar invalid."));
    return;
  }

  try {
    const volunteer = await readAdminVolunteerRecordById(volunteerRecordId);
    if (!volunteer) {
      next(new AppError(404, "VOLUNTEER_NOT_FOUND", "Voluntarul nu a fost gasit."));
      return;
    }

    sendSuccess(res, volunteer);
  } catch (error) {
    next(error);
  }
}
