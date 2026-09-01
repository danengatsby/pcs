import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../lib/errors.js";
import { sendSignupNotificationEmail } from "../../../lib/notificationEmails.js";
import { hashPassword } from "../../../lib/password.js";
import { insertSignupUser } from "../repository.js";
import { sendUniformSignupSuccess } from "../responses.js";
import { sanitizeUser } from "../user.js";
import { signupSchema } from "../validation.js";

export async function signupHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(
      new AppError(
        400,
        "AUTH_SIGNUP_VALIDATION_FAILED",
        issue?.message ?? "Date signup invalide."
      )
    );
    return;
  }

  const payload = parsed.data;

  try {
    const passwordHash = await hashPassword(payload.password);
    const createdUser = await insertSignupUser({
      fullName: payload.fullName,
      email: payload.email.toLowerCase(),
      passwordHash,
    });

    const sanitizedUser = createdUser ? sanitizeUser(createdUser) : null;
    if (sanitizedUser) {
      void sendSignupNotificationEmail({
        fullName: sanitizedUser.fullName,
        email: sanitizedUser.email,
      });
    }

    sendUniformSignupSuccess(res);
  } catch (error) {
    next(error);
  }
}
