import type { NextFunction, Request, Response } from "express";
import { revokeAllRefreshTokenSessionsForUser } from "../../../lib/authRefreshToken.js";
import { sendSuccess } from "../../../lib/http.js";
import { readAuthUser } from "../../../lib/authMiddleware.js";
import { clearRefreshCookies } from "../cookies.js";

export async function revokeAllSessionsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = readAuthUser(res);
    if (!user) {
      // requireAuth should prevent this, but keep it safe.
      clearRefreshCookies(res);
      sendSuccess(res, { message: "Sesiuni revocate." });
      return;
    }

    await revokeAllRefreshTokenSessionsForUser(user.id);

    clearRefreshCookies(res);
    sendSuccess(res, { message: "Sesiuni revocate." });
  } catch (error) {
    next(error);
  }
}
