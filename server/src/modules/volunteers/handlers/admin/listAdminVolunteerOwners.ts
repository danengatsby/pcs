import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../../../lib/http.js";
import { requireAdminAccess } from "../../../../lib/adminAuthorization.js";
import { listAdminVolunteerOwners } from "../../repository.js";

export async function listAdminVolunteerOwnersHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const owners = await listAdminVolunteerOwners(requireAdminAccess(res).scope);
    sendSuccess(res, owners);
  } catch (error) {
    next(error);
  }
}
