import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../../../lib/http.js";
import { listVolunteerCountsByCounty } from "../../repository.js";

export async function listVolunteersByCountyHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rows = await listVolunteerCountsByCounty();
    sendSuccess(res, rows, {
      meta: {
        count: rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
}
