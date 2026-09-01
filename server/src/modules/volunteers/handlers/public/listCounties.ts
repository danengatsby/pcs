import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../../../lib/http.js";
import { countyNames } from "../../counties.js";

export function listVolunteerCountiesHandler(
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  sendSuccess(res, countyNames, {
    meta: {
      count: countyNames.length,
    },
  });
}
