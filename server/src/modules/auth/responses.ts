import type { Response } from "express";
import { sendSuccess } from "../../lib/http.js";
import { signupUniformMessage, type SignupUniformResponse } from "./types.js";

export function sendUniformSignupSuccess(res: Response): void {
  const data: SignupUniformResponse = {
    message: signupUniformMessage,
    signupAccepted: true,
    nextStep: "signin",
  };
  sendSuccess(res, data, { status: 201 });
}
