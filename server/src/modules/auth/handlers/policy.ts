import type { Request, Response } from "express";
import { sendSuccess } from "../../../lib/http.js";
import { buildAuthTokenPolicy } from "../policy.js";

export function policyHandler(_req: Request, res: Response): void {
  sendSuccess(res, {
    tokenPolicy: buildAuthTokenPolicy(),
  });
}
