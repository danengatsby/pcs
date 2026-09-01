import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { AppError, isDbError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { sendVolunteerSignupNotificationEmail } from "../../../../lib/notificationEmails.js";
import { env } from "../../../../lib/env.js";
import { hashPassword, verifyPassword } from "../../../../lib/password.js";
import { withPrismaTransaction } from "../../../../lib/prismaTransaction.js";
import { readClientIp } from "../../../auth/requestContext.js";
import { verifyCaptchaToken } from "../../captcha.js";
import { volunteerSchema } from "../../schema.js";
import { normalizeCountyKey } from "../../counties.js";
import {
  findUserAuthByEmail,
  findVolunteerByEmail,
  insertVolunteer,
  insertVolunteerUser,
} from "../../repository.js";

function readHoneypot(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }

  const record = body as Record<string, unknown>;
  return typeof record.website === "string" ? record.website.trim() : "";
}

function isCaptchaServiceIssue(reason: string): boolean {
  return reason === "captcha_response_invalid" || reason === "captcha_secret_missing";
}

async function assertVolunteerCaptcha(req: Request, captchaToken: string): Promise<void> {
  if (env.captchaMode === "disabled") {
    return;
  }

  const normalizedToken = captchaToken.trim();
  if (!normalizedToken) {
    if (env.captchaMode === "required") {
      throw new AppError(400, "VOLUNTEER_CAPTCHA_REQUIRED", "Confirma verificarea anti-abuz.");
    }

    return;
  }

  if (!env.captchaSecret) {
    return;
  }

  const verification = await verifyCaptchaToken(normalizedToken, readClientIp(req));
  if (verification.valid) {
    return;
  }

  if (isCaptchaServiceIssue(verification.reason)) {
    throw new AppError(
      503,
      "VOLUNTEER_CAPTCHA_UNAVAILABLE",
      "Verificarea anti-abuz este indisponibila temporar. Incearca din nou."
    );
  }

  throw new AppError(400, "VOLUNTEER_CAPTCHA_INVALID", "Verificarea anti-abuz a esuat. Incearca din nou.");
}

export async function createVolunteerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const honeypot = readHoneypot(req.body);
  if (honeypot) {
    sendSuccess(
      res,
      {
        accepted: true,
        ignored: true,
        message: "Inscriere ADERENT inregistrata.",
      },
      { status: 202 }
    );
    return;
  }

  const parsed = volunteerSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(
      new AppError(
        400,
        "VOLUNTEER_VALIDATION_FAILED",
        issue?.message ?? "Date invalide."
      )
    );
    return;
  }

  const payload = parsed.data;
  const normalizedEmail = payload.email.toLowerCase();

  try {
    await assertVolunteerCaptcha(req, payload.captchaToken);

    const createdVolunteerId = await withPrismaTransaction(async (tx) => {
      const countyRow = await tx.county.findUnique({
        where: {
          normalizedName: normalizeCountyKey(payload.county),
        },
        select: { id: true },
      });

      if (!countyRow) {
        throw new AppError(400, "VOLUNTEER_INVALID_COUNTY", "Judet invalid. Selecteaza un judet din lista oficiala.");
      }
      const existingVolunteer = await findVolunteerByEmail(normalizedEmail, tx);
      if (existingVolunteer) {
        throw new AppError(409, "VOLUNTEER_EMAIL_EXISTS", "Email deja inscris.");
      }

      const existingUser = await findUserAuthByEmail(normalizedEmail, tx);

      if (existingUser) {
        const passwordMatches = await verifyPassword(payload.password, existingUser.passwordHash);
        if (!passwordMatches) {
          throw new AppError(
            409,
            "VOLUNTEER_ACCOUNT_EXISTS",
            "Exista deja un cont pentru acest email. Foloseste parola contului existent pentru autentificare."
          );
        }
      } else {
        const passwordHash = await hashPassword(payload.password);
        await insertVolunteerUser({
          fullName: payload.fullName,
          email: normalizedEmail,
          passwordHash,
          runner: tx,
        });
      }

      return insertVolunteer({
        fullName: payload.fullName,
        email: normalizedEmail,
        phone: payload.phone,
        county: payload.county,
        countyId: countyRow.id,
        locality: payload.locality,
        skills: payload.skills,
        motivation: payload.motivation,
        runner: tx,
      });
    });

    sendSuccess(
      res,
      {
        message: "Inscriere ADERENT inregistrata.",
        id: createdVolunteerId,
      },
      { status: 201 }
    );

    void sendVolunteerSignupNotificationEmail({
      fullName: payload.fullName,
      email: normalizedEmail,
      county: payload.county,
      locality: payload.locality,
      phone: payload.phone,
      skills: payload.skills,
      motivation: payload.motivation,
    });
  } catch (error) {
    if (
      (isDbError(error) && error.code === "23505")
      || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    ) {
      next(new AppError(409, "VOLUNTEER_EMAIL_EXISTS", "Email deja inscris."));
      return;
    }

    next(error);
  }
}
