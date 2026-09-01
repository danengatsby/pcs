import type { Request, RequestHandler } from "express";
import { readAuthUser } from "../../../lib/authMiddleware.js";
import { recordAdminAudit } from "../../../lib/adminAudit.js";
import { sendEmail } from "../../../lib/email.js";
import { env } from "../../../lib/env.js";
import { AppError } from "../../../lib/errors.js";
import { sendSuccess } from "../../../lib/http.js";
import { emailTestSchema } from "../admin.shared.js";

export const sendAdminEmailTestHandler: RequestHandler = async (req, res, next) => {
  const parsed = emailTestSchema.safeParse((req as Request).body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(new AppError(400, "EMAIL_TEST_VALIDATION_FAILED", issue?.message ?? "Date email test invalide."));
    return;
  }

  if (!env.emailNotificationsEnabled) {
    next(
      new AppError(
        400,
        "EMAIL_NOTIFICATIONS_DISABLED",
        "Notificarile email sunt dezactivate. Activeaza EMAIL_NOTIFICATIONS_ENABLED in server/.env."
      )
    );
    return;
  }

  const payload = parsed.data;

  try {
    const authUser = readAuthUser(res);
    const recipient = (payload.to ?? authUser?.email ?? "").trim().toLowerCase();
    if (!recipient) {
      next(new AppError(400, "EMAIL_TEST_RECIPIENT_MISSING", "Lipseste destinatarul emailului de test."));
      return;
    }

    const subject = payload.subject?.trim() || `Test notificare PCS (${new Date().toISOString()})`;
    const message = payload.message?.trim() || [
      "Acesta este un email de test trimis din panoul admin PCS.",
      "",
      `Destinatar: ${recipient}`,
      `Trimis la: ${new Date().toISOString()}`,
      `Actor: ${authUser?.email ?? "admin"}`,
    ].join("\n");

    await sendEmail({
      to: [recipient],
      subject,
      text: message,
    });

    if (authUser) {
      await recordAdminAudit({
        actor: {
          userId: authUser.id,
          email: authUser.email,
          role: authUser.role,
        },
        action: "email.test_send",
        targetType: "notification",
        targetId: recipient,
        details: {
          recipient,
          subjectLength: subject.length,
          messageLength: message.length,
        },
      });
    }

    sendSuccess(res, {
      message: "Email-ul de test a fost trimis.",
      to: recipient,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(new AppError(502, "EMAIL_TEST_SEND_FAILED", "Trimiterea emailului de test a esuat."));
  }
};
