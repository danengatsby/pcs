import type { NextFunction, Request, Response } from "express";
import { readAuthUser } from "../../../lib/authMiddleware.js";
import { AppError } from "../../../lib/errors.js";
import { sendSuccess } from "../../../lib/http.js";
import { sanitizeUser } from "../user.js";

export function meHandler(_req: Request, res: Response, next: NextFunction): void {
  const user = readAuthUser(res);
  if (!user) {
    next(new AppError(401, "AUTH_UNAUTHORIZED", "Token lipsa sau invalid."));
    return;
  }

  sendSuccess(res, { user: sanitizeUser(user) });
}
