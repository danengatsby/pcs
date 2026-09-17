import type { NextFunction, Request, Response } from "express";
import { openPublicAdminAccess } from "../../../lib/adminPublicAccess.js";
import { sendAuthenticatedSession } from "./session.js";

export async function adminPublicLoginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    // The caller supplies no identity, password or personal capability.
    const user = await openPublicAdminAccess();
    await sendAuthenticatedSession(req, res, user, null);
  } catch (error) { next(error); }
}
