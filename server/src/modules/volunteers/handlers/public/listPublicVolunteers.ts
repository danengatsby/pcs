import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../../../lib/http.js";
import { parsePublicVolunteersLimit } from "../../parsing.js";
import { listPublicVolunteers } from "../../repository.js";

export async function listPublicVolunteersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = parsePublicVolunteersLimit(req.query.limit);
    const rows = await listPublicVolunteers(limit);

    sendSuccess(res, rows, {
      meta: {
        count: rows.length,
        limit,
        sanitized: true,
      },
    });
  } catch (error) {
    next(error);
  }
}
