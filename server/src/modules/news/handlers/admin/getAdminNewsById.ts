import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../../lib/errors.js";
import { sendSuccess } from "../../../../lib/http.js";
import { readNewsMediaMap } from "../../repository.js";
import { readAdminNewsById } from "../../repositoryAdmin.js";
import { parseNewsId } from "../../parsing.js";
import { toAdminNewsRow } from "../../mappers.js";

export async function getAdminNewsById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseNewsId(req.params.id);
    if (!id) {
      next(new AppError(400, "NEWS_ID_INVALID", "ID stire invalid."));
      return;
    }

    const row = await readAdminNewsById(id);
    if (!row) {
      next(new AppError(404, "NEWS_NOT_FOUND", "Stirea nu a fost gasita."));
      return;
    }

    const mediaMap = await readNewsMediaMap([id]);
    sendSuccess(res, toAdminNewsRow(row, mediaMap.get(id) ?? []));
  } catch (error) {
    next(error);
  }
}
