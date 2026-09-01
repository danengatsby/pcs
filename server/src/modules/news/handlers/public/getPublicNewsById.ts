import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { parseNewsId } from "../../parsing.js";
import { readPublicNewsDetailById } from "../../repositoryPublic.js";

export async function getPublicNewsById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseNewsId(req.params.id);
    if (!id) {
      next(new AppError(400, "NEWS_ID_INVALID", "ID stire invalid."));
      return;
    }

    const row = await readPublicNewsDetailById(id);
    if (!row) {
      next(new AppError(404, "NEWS_NOT_FOUND", "Stirea nu a fost gasita."));
      return;
    }

    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}
