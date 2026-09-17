import type { NextFunction, Request, Response } from "express";
import QRCode from "qrcode";
import { completeAdminActivation, previewAdminActivation } from "../../../lib/adminActivation.js";
import { AppError } from "../../../lib/errors.js";
import { sendSuccess } from "../../../lib/http.js";
import { activationCompleteSchema, activationPreviewSchema } from "../validation.js";
import { sendAuthenticatedSession } from "./session.js";

export async function previewAdminActivationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const parsed = activationPreviewSchema.safeParse(req.body);
    if (!parsed.success) {throw new AppError(400, "PAYLOAD_INVALID", "Deschide linkul complet de activare primit de la administrator.");}
    const { uri, ...enrollment } = await previewAdminActivation(parsed.data.token);
    const qrDataUrl = await QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 4, width: 320 });
    sendSuccess(res, { ...enrollment, qrDataUrl });
  } catch (error) { next(error); }
}

export async function completeAdminActivationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const parsed = activationCompleteSchema.safeParse(req.body);
    if (!parsed.success) {throw new AppError(400, "PAYLOAD_INVALID", parsed.error.issues[0]?.message ?? "Verifică parola și codul de autentificare.");}
    const { user, credentialId } = await completeAdminActivation(parsed.data);
    await sendAuthenticatedSession(req, res, user, credentialId);
  } catch (error) { next(error); }
}
