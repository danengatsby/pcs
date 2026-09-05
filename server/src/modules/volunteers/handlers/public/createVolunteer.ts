import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { AppError, isDbError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { sendVolunteerSignupNotificationEmail } from "../../../../lib/notificationEmails.js";
import { hashPassword, verifyPassword } from "../../../../lib/password.js";
import { withPrismaTransaction } from "../../../../lib/prismaTransaction.js";
import { volunteerSchema } from "../../schema.js";
import { normalizeCountyKey } from "../../counties.js";
import {
  findUserAuthByEmail,
  findVolunteerByEmail,
  insertVolunteer,
  insertVolunteerUser,
  upsertPendingMembership,
} from "../../repository.js";

function readHoneypot(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }

  const record = body as Record<string, unknown>;
  return typeof record.website === "string" ? record.website.trim() : "";
}

export async function createVolunteerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const honeypot = readHoneypot(req.body);
  if (honeypot) {
    sendSuccess(
      res,
      {
        accepted: true,
        ignored: true,
        message: "Cerere de aderare inregistrata.",
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
      let userId: number;

      if (existingUser) {
        const passwordMatches = await verifyPassword(payload.password, existingUser.passwordHash);
        if (!passwordMatches) {
          throw new AppError(
            409,
            "VOLUNTEER_ACCOUNT_EXISTS",
            "Exista deja un cont pentru acest email. Foloseste parola contului existent pentru autentificare."
          );
        }
        userId = existingUser.id;
      } else {
        const passwordHash = await hashPassword(payload.password);
        userId = await insertVolunteerUser({
          fullName: payload.fullName,
          email: normalizedEmail,
          passwordHash,
          runner: tx,
        });
      }

      const volunteerId = await insertVolunteer({
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
      await upsertPendingMembership({
        userId,
        volunteerId,
        fullName: payload.fullName,
        email: normalizedEmail,
        runner: tx,
      });
      return volunteerId;
    });

    sendSuccess(
      res,
      {
        message: "Cerere de aderare inregistrata.",
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
