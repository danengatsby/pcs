import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../lib/errors.js";
import { verifyPassword } from "../../../lib/password.js";
import { findUserForSignin } from "../repository.js";
import { consumeDummySigninHash } from "../user.js";
import { signinSchema } from "../validation.js";
import { isAdminRole, verifyAdminSecondFactor } from "../../../lib/adminMfa.js";
import { sendAuthenticatedSession } from "./session.js";

export async function signinHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = signinSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(
      new AppError(
        400,
        "AUTH_SIGNIN_VALIDATION_FAILED",
        issue?.message ?? "Date signin invalide."
      )
    );
    return;
  }

  const payload = parsed.data;

  try {
    res.setHeader("Cache-Control", "private, no-store");
    const user = await findUserForSignin(payload.email);
    if (!user) {
      await consumeDummySigninHash(payload.password);
      next(new AppError(401, "INVALID_CREDENTIALS", "Utilizatorul sau parola sunt invalide."));
      return;
    }
    if (!await verifyPassword(payload.password, user.passwordHash)) {
      next(new AppError(401, "INVALID_CREDENTIALS", "Utilizatorul sau parola sunt invalide."));
      return;
    }
    const credentialId = isAdminRole(user.role) ? await verifyAdminSecondFactor(user, payload.mfaCode) : null;

    await sendAuthenticatedSession(req, res, user, credentialId);
  } catch (error) {
    next(error);
  }
}
