import type { NextFunction, Request, Response } from "express";
import { consumeAdminDirectLogin, readAdminDirectLogin } from "../../../lib/adminDirectLogin.js";
import { AppError } from "../../../lib/errors.js";
import { adminDirectLoginSchema } from "../validation.js";
import { sendAuthenticatedSession } from "./session.js";

export async function adminDirectLoginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const parsed = adminDirectLoginSchema.safeParse(req.body);
    if (!parsed.success) {throw new AppError(400, "PAYLOAD_INVALID", "Deschide linkul personal de acces direct.");}
    const { token } = parsed.data;
    const { user, credentialId } = await readAdminDirectLogin(token);
    await sendAuthenticatedSession(req, res, user, credentialId, {
      verify: client => consumeAdminDirectLogin(client, token, user.id, credentialId),
    });
  } catch (error) {next(error);}
}
